from typing import Dict, Any, Optional, List
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
    self_turnover = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.user_id == agent.id
    ).scalar() or 0.0

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

def get_agent_tier_config(setting: Optional[SystemSetting] = None) -> List[Dict[str, Any]]:
    """
    4-Tier Agent Commission & Turnover Configuration:
    - Tier 1: 3,000,000 MMK Target ==> 15% Commission
    - Tier 2: 6,000,000 MMK Target ==> 20% Commission
    - Tier 3: 10,000,000 MMK Target ==> 25% Commission
    - Tier 4: 15,000,000 MMK Target ==> 30% Commission
    """
    t1_target = float(getattr(setting, "agent_tier1_turnover", 3000000.0) or 3000000.0)
    t1_comm = float(getattr(setting, "agent_tier1_commission", 15.0) or 15.0)

    t2_target = float(getattr(setting, "agent_tier2_turnover", 6000000.0) or 6000000.0)
    t2_comm = float(getattr(setting, "agent_tier2_commission", 20.0) or 20.0)

    t3_target = float(getattr(setting, "agent_tier3_turnover", 10000000.0) or 10000000.0)
    t3_comm = float(getattr(setting, "agent_tier3_commission", 25.0) or 25.0)

    t4_target = float(getattr(setting, "agent_tier4_turnover", 15000000.0) or 15000000.0)
    t4_comm = float(getattr(setting, "agent_tier4_commission", 30.0) or 30.0)

    d1 = float(getattr(setting, "agent_lvl1_deposit", 100000.0) or 100000.0)
    d2 = float(getattr(setting, "agent_lvl2_deposit", 300000.0) or 300000.0)
    d3 = float(getattr(setting, "agent_lvl3_deposit", 500000.0) or 500000.0)
    d4 = float(getattr(setting, "agent_lvl4_deposit", 1000000.0) or 1000000.0)

    return [
        {"tier": 1, "name": "Tier 1", "badge": "Bronze", "target": t1_target, "commission_rate": t1_comm / 100.0, "commission_pct": t1_comm, "deposit": d1},
        {"tier": 2, "name": "Tier 2", "badge": "Silver", "target": t2_target, "commission_rate": t2_comm / 100.0, "commission_pct": t2_comm, "deposit": d2},
        {"tier": 3, "name": "Tier 3", "badge": "Gold", "target": t3_target, "commission_rate": t3_comm / 100.0, "commission_pct": t3_comm, "deposit": d3},
        {"tier": 4, "name": "Tier 4", "badge": "Platinum / Master", "target": t4_target, "commission_rate": t4_comm / 100.0, "commission_pct": t4_comm, "deposit": d4},
    ]

def get_agent_commission_rate(agent: User, db: Session) -> float:
    """
    Returns active commission percentage as decimal (0.15, 0.20, 0.25, 0.30)
    dynamically calculated from agent's combined turnover.
    """
    if not agent:
        return 0.15
    setting = db.query(SystemSetting).first()
    tiers = get_agent_tier_config(setting)
    stats = get_agent_turnover_stats(agent, db)
    tot = stats["total_turnover"]

    if tot >= tiers[3]["target"]: # >= 15M
        return tiers[3]["commission_rate"]
    elif tot >= tiers[2]["target"]: # >= 10M
        return tiers[2]["commission_rate"]
    elif tot >= tiers[1]["target"]: # >= 6M
        return tiers[1]["commission_rate"]
    else: # Tier 1
        return tiers[0]["commission_rate"]

def evaluate_and_update_agent_level(agent: User, db: Session, commit: bool = True) -> Dict[str, Any]:
    """
    Evaluates Agent Tier (Tier 1 to 4) based on Total Combined Turnover.
    - Tier 1: 3,000,000 MMK ==> 15%
    - Tier 2: 6,000,000 MMK ==> 20%
    - Tier 3: 10,000,000 MMK ==> 25%
    - Tier 4: 15,000,000 MMK ==> 30%
    """
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.flush()

    tiers = get_agent_tier_config(setting)
    multiplier = float(setting.agent_credit_multiplier or 1.6)

    stats = get_agent_turnover_stats(agent, db)
    tot = stats["total_turnover"]

    # Current tier parsing
    current_tier_num = 1
    if agent.level:
        try:
            current_tier_num = int(''.join(filter(str.isdigit, str(agent.level))) or 1)
        except Exception:
            current_tier_num = 1

    deposit_val = float(agent.security_deposit or 0.0)
    if deposit_val >= tiers[3]["deposit"]:
        current_tier_num = max(current_tier_num, 4)
    elif deposit_val >= tiers[2]["deposit"]:
        current_tier_num = max(current_tier_num, 3)
    elif deposit_val >= tiers[1]["deposit"]:
        current_tier_num = max(current_tier_num, 2)

    # Determine qualified tier by turnover
    if tot >= tiers[3]["target"]: # >= 15,000,000
        qualified_tier = 4
        target_dep = tiers[3]["deposit"]
        next_target = None
        prev_target = tiers[2]["target"]
        active_comm_pct = tiers[3]["commission_pct"]
    elif tot >= tiers[2]["target"]: # >= 10,000,000
        qualified_tier = 3
        target_dep = tiers[2]["deposit"]
        next_target = tiers[3]["target"]
        prev_target = tiers[1]["target"]
        active_comm_pct = tiers[2]["commission_pct"]
    elif tot >= tiers[1]["target"]: # >= 6,000,000
        qualified_tier = 2
        target_dep = tiers[1]["deposit"]
        next_target = tiers[2]["target"]
        prev_target = tiers[0]["target"]
        active_comm_pct = tiers[1]["commission_pct"]
    else: # Tier 1
        qualified_tier = 1
        target_dep = tiers[0]["deposit"]
        next_target = tiers[1]["target"] if tot >= tiers[0]["target"] else tiers[0]["target"]
        prev_target = 0.0
        active_comm_pct = tiers[0]["commission_pct"]

    effective_tier = max(qualified_tier, current_tier_num)
    if effective_tier > 4:
        effective_tier = 4

    sel_tier = tiers[effective_tier - 1]
    active_comm_pct = sel_tier["commission_pct"]
    active_comm_rate = sel_tier["commission_rate"]
    target_dep = max(deposit_val, sel_tier["deposit"])

    if effective_tier == 4:
        next_target = None
        prev_target = tiers[2]["target"]
    elif effective_tier == 3:
        next_target = tiers[3]["target"]
        prev_target = tiers[1]["target"]
    elif effective_tier == 2:
        next_target = tiers[2]["target"]
        prev_target = tiers[0]["target"]
    else:
        next_target = tiers[1]["target"] if tot >= tiers[0]["target"] else tiers[0]["target"]
        prev_target = 0.0

    # Auto upgrade notification
    if qualified_tier > current_tier_num:
        agent.level = f"Tier {qualified_tier}"
        agent.commission_rate = active_comm_rate
        agent.security_deposit = target_dep
        agent.credit_limit = target_dep * multiplier

        notif = Notification(
            user_id=agent.id,
            title=f"🎉 Agent Tier {qualified_tier} သို့ တိုးမြှင့်အောင်မြင်ပါသည်!",
            message=(
                f"ဂုဏ်ယူပါသည်! သင်၏ စုစုပေါင်းထိုးကြေး (Agent ထိုးကြေး + Downline ထိုးကြေး) "
                f"{tot:,.0f} ကျပ် ပြည့်မီသဖြင့် Tier {qualified_tier} သို့ တိုးမြှင့်လိုက်ပါပြီ။ "
                f"ကော်မရှင်နှုန်းထား {int(active_comm_pct)}% ခံစားခွင့် ရရှိပါပြီ ခင်ဗျာ။"
            ),
            notif_type="AGENT_LEVEL_UP",
            is_read=False
        )
        db.add(notif)
    else:
        tier_label = f"Tier {effective_tier}"
        if agent.level != tier_label:
            agent.level = tier_label
        agent.commission_rate = active_comm_rate
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
        "level": agent.level or f"Tier {effective_tier}",
        "tier": effective_tier,
        "level_number": effective_tier,
        "commission_rate": active_comm_rate,
        "commission_percent": int(active_comm_pct),
        "commission_rate_str": f"{int(active_comm_pct)}%",
        "self_turnover": stats["self_turnover"],
        "downline_turnover": stats["downline_turnover"],
        "total_turnover": tot,
        "security_deposit": float(agent.security_deposit or target_dep),
        "credit_limit": float(agent.credit_limit or (target_dep * multiplier)),
        "used_credit": float(agent.used_credit or 0.0),
        "available_credit": max(0.0, float(agent.credit_limit or (target_dep * multiplier)) - float(agent.used_credit or 0.0)),
        "credit_multiplier": float(multiplier),
        "is_agent_credit_enabled": bool(getattr(setting, "is_agent_credit_enabled", False)),
        "next_level": f"Tier {effective_tier + 1}" if effective_tier < 4 else None,
        "next_level_target": float(next_target) if next_target else None,
        "turnover_remaining": float(turnover_remaining),
        "progress_percent": progress_pct,
        "tiers": tiers
    }
