from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.user import User, UserRole, Notification
from app.models.bet import BetSlip
from app.models.settings import SystemSetting

def get_agent_turnover_stats(agent: User, db: Session) -> Dict[str, float]:
    """
    Computes Agent's combined turnover:
    - self_turnover: Bets placed directly by the agent
    - downline_turnover: Bets placed by downline players referred by this agent
    - total_turnover: self_turnover + downline_turnover
    """
    # 1. Agent self-bets turnover
    self_turnover = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.user_id == agent.id
    ).scalar() or 0.0

    # 2. Downline players bets turnover
    downline_turnover = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).outerjoin(
        User, BetSlip.user_id == User.id
    ).filter(
        BetSlip.user_id != agent.id,
        or_(
            BetSlip.agent_id == agent.id,
            User.agent_id == agent.id,
            User.referred_by_code == agent.agent_code
        )
    ).scalar() or 0.0

    return {
        "self_turnover": float(self_turnover),
        "downline_turnover": float(downline_turnover),
        "total_turnover": float(self_turnover + downline_turnover)
    }

def evaluate_and_update_agent_level(agent: User, db: Session, commit: bool = True) -> Dict[str, Any]:
    """
    Evaluates Agent Level (Level 1 to 5) based on Total Combined Turnover and Deposit.
    Deposit requirements:
      Lvl 1: 100,000 MMK
      Lvl 2: 300,000 MMK
      Lvl 3: 500,000 MMK
      Lvl 4: 800,000 MMK
      Lvl 5: 1,000,000 MMK
    Credit = Deposit x Multiplier (default 3x)
    """
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.flush()

    multiplier = setting.agent_credit_multiplier or 1.6
    lvl1_dep = setting.agent_lvl1_deposit or 100000.0
    lvl2_dep = setting.agent_lvl2_deposit or 300000.0
    lvl3_dep = setting.agent_lvl3_deposit or 500000.0
    lvl4_dep = setting.agent_lvl4_deposit or 800000.0
    lvl5_dep = setting.agent_lvl5_deposit or 1000000.0

    lvl2_target = setting.agent_lvl2_target_turnover or 2000000.0
    lvl3_target = setting.agent_lvl3_target_turnover or 5000000.0
    lvl4_target = setting.agent_lvl4_target_turnover or 10000000.0
    lvl5_target = setting.agent_lvl5_target_turnover or 20000000.0

    stats = get_agent_turnover_stats(agent, db)
    tot = stats["total_turnover"]

    # Parse current level
    current_lvl_num = 1
    if agent.level:
        try:
            current_lvl_num = int(''.join(filter(str.isdigit, str(agent.level))) or 1)
        except Exception:
            current_lvl_num = 1

    # If agent already holds high deposit (e.g. Master Agent Daw Hla Hla with >= 1,000,000 deposit), recognize tier
    deposit_val = float(agent.security_deposit or 0.0)
    if deposit_val >= lvl5_dep:
        current_lvl_num = max(current_lvl_num, 5)
    elif deposit_val >= lvl4_dep:
        current_lvl_num = max(current_lvl_num, 4)
    elif deposit_val >= lvl3_dep:
        current_lvl_num = max(current_lvl_num, 3)
    elif deposit_val >= lvl2_dep:
        current_lvl_num = max(current_lvl_num, 2)

    # Determine qualified level by turnover progression
    if tot >= lvl5_target:
        qualified_lvl = 5
        target_dep = lvl5_dep
        next_target = None
        prev_target = lvl4_target
    elif tot >= lvl4_target:
        qualified_lvl = 4
        target_dep = lvl4_dep
        next_target = lvl5_target
        prev_target = lvl3_target
    elif tot >= lvl3_target:
        qualified_lvl = 3
        target_dep = lvl3_dep
        next_target = lvl4_target
        prev_target = lvl2_target
    elif tot >= lvl2_target:
        qualified_lvl = 2
        target_dep = lvl2_dep
        next_target = lvl3_target
        prev_target = 0.0
    else:
        qualified_lvl = 1
        target_dep = lvl1_dep
        next_target = lvl2_target
        prev_target = 0.0

    # Effective level is highest of turnover qualified or deposit qualified
    effective_lvl = max(qualified_lvl, current_lvl_num)
    
    if effective_lvl == 5:
        target_dep = max(deposit_val, lvl5_dep)
        next_target = None
        prev_target = lvl4_target
    elif effective_lvl == 4:
        target_dep = max(deposit_val, lvl4_dep)
        next_target = lvl5_target
        prev_target = lvl3_target
    elif effective_lvl == 3:
        target_dep = max(deposit_val, lvl3_dep)
        next_target = lvl4_target
        prev_target = lvl2_target
    elif effective_lvl == 2:
        target_dep = max(deposit_val, lvl2_dep)
        next_target = lvl3_target
        prev_target = 0.0
    else:
        target_dep = max(deposit_val, lvl1_dep)
        next_target = lvl2_target
        prev_target = 0.0

    # Auto upgrade level if qualified level advances beyond current
    if qualified_lvl > current_lvl_num:
        agent.level = f"Level {qualified_lvl}"
        agent.security_deposit = target_dep
        agent.credit_limit = target_dep * multiplier
        
        # Send celebratory in-app notification
        notif = Notification(
            user_id=agent.id,
            title=f"🎉 Agent Level {qualified_lvl} သို့ တိုးမြှင့်အောင်မြင်ပါသည်!",
            message=(
                f"ဂုဏ်ယူပါသည်! သင်၏ စုစုပေါင်းထိုးကြေး (Agent ထိုးကြေး + Downline ထိုးကြေး) "
                f"{tot:,.0f} ကျပ် ပြည့်မီသဖြင့် Level {qualified_lvl} သို့ တိုးမြှင့်လိုက်ပါပြီ။ "
                f"စပေါ်ငွေ {target_dep:,.0f} ကျပ် ပေါ်မူတည်၍ Credit Limit အား {target_dep * multiplier:,.0f} ကျပ် ({multiplier:.1f} ဆ) သို့ တိုးမြှင့်ပေးလိုက်ပါပြီ ခင်ဗျာ။"
            ),
            notif_type="AGENT_LEVEL_UP",
            is_read=False
        )
        db.add(notif)
    else:
        if agent.level != f"Level {effective_lvl}":
            agent.level = f"Level {effective_lvl}"
        if not agent.security_deposit or agent.security_deposit < target_dep:
            agent.security_deposit = target_dep
        if not agent.credit_limit or agent.credit_limit <= 0:
            agent.credit_limit = (agent.security_deposit or target_dep) * multiplier

    if commit:
        db.commit()
        db.refresh(agent)

    # Progress calculation to next level
    progress_pct = 100.0
    turnover_remaining = 0.0
    if next_target:
        span = next_target - prev_target
        curr = max(0.0, tot - prev_target)
        progress_pct = min(100.0, round((curr / span) * 100.0, 1)) if span > 0 else 0.0
        turnover_remaining = max(0.0, next_target - tot)

    return {
        "level": agent.level or f"Level {effective_lvl}",
        "level_number": effective_lvl,
        "self_turnover": stats["self_turnover"],
        "downline_turnover": stats["downline_turnover"],
        "total_turnover": tot,
        "security_deposit": float(agent.security_deposit or target_dep),
        "credit_limit": float(agent.credit_limit or (target_dep * multiplier)),
        "used_credit": float(agent.used_credit or 0.0),
        "available_credit": max(0.0, float(agent.credit_limit or (target_dep * multiplier)) - float(agent.used_credit or 0.0)),
        "credit_multiplier": float(multiplier),
        "is_agent_credit_enabled": bool(getattr(setting, "is_agent_credit_enabled", False)),
        "next_level": f"Level {effective_lvl + 1}" if effective_lvl < 5 else None,
        "next_level_target": float(next_target) if next_target else None,
        "turnover_remaining": float(turnover_remaining),
        "progress_percent": progress_pct,
        "tier_deposits": {
            "1": lvl1_dep,
            "2": lvl2_dep,
            "3": lvl3_dep,
            "4": lvl4_dep,
            "5": lvl5_dep
        },
        "tier_targets": {
            "2": lvl2_target,
            "3": lvl3_target,
            "4": lvl4_target,
            "5": lvl5_target
        }
    }
