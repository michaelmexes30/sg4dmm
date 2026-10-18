import itertools
from typing import List, Dict, Tuple, Any
from app.config import settings

def validate_4d_number(num_str: str, bet_type: str = "ordinary") -> bool:
    """Validates 4D number format based on bet type."""
    cleaned = num_str.strip().upper()
    bet_type_lower = bet_type.lower()
    if bet_type_lower in ["ordinary", "direct"]:
        return len(cleaned) == 4 and cleaned.isdigit()
    elif bet_type_lower in ["box", "permutation", "ibox", "r"]:
        return len(cleaned) == 4 and cleaned.isdigit()
    elif bet_type_lower in ["roll", "series", "s", "roll_first", "roll_last"]:
        if len(cleaned) != 4:
            return False
        if cleaned.isdigit():
            return True
        if cleaned[0] in ("R", "S"):
            return cleaned[1:].isdigit()
        elif cleaned[-1] in ("R", "S"):
            return cleaned[:3].isdigit()
        return False
    return False

def validate_bet_amount(amount: float) -> Tuple[bool, str]:
    """
    Validates betting limits per number:
    Minimum: 50 MMK
    Maximum: 10,000 MMK
    """
    if amount < settings.MIN_BET_AMOUNT:
        return False, f"Minimum bet per number is {settings.MIN_BET_AMOUNT} MMK."
    if amount > settings.MAX_BET_AMOUNT:
        return False, f"Maximum bet per number is {settings.MAX_BET_AMOUNT:,} MMK."
    return True, "Valid bet amount."

def generate_combinations(num_str: str, bet_type: str) -> List[str]:
    """
    Expands a bet number into all playable 4-digit combinations.
    - Ordinary: [num_str]
    - Box / Permutation (R): all unique permutations (1, 4, 6, 12, or 24)
    - Roll / Series (S): 10 combinations (0-9 substituted for 'S' or 'R')
    """
    cleaned = num_str.strip().upper()
    bet_type_lower = bet_type.lower()
    
    if bet_type_lower in ["ordinary", "direct"]:
        return [cleaned]
        
    elif bet_type_lower in ["box", "permutation", "system", "ibox", "r"]:
        perms = set("".join(p) for p in itertools.permutations(cleaned))
        return sorted(list(perms))
        
    elif bet_type_lower in ["roll", "series", "s", "roll_first", "roll_last"]:
        combos = []
        if cleaned[0] in ("R", "S"):
            suffix = cleaned[1:]
            for d in range(10):
                combos.append(f"{d}{suffix}")
        elif cleaned[-1] in ("R", "S"):
            prefix = cleaned[:3]
            for d in range(10):
                combos.append(f"{prefix}{d}")
        elif cleaned.isdigit():
            return [cleaned]
        else:
            prefix = cleaned[:3]
            for d in range(10):
                combos.append(f"{prefix}{d}")
        return combos
        
    return [cleaned]

def calculate_stake(
    number: str,
    bet_type: str,
    big_amount: int = 0,
    small_amount: int = 0
) -> Dict[str, Any]:
    """
    Calculates the total stake for a bet item and returns generated combinations.
    """
    combos = generate_combinations(number, bet_type)
    combo_count = len(combos)
    
    total_big = big_amount * combo_count
    total_small = small_amount * combo_count
    grand_total = total_big + total_small
    
    return {
        "number": number,
        "bet_type": bet_type,
        "combination_count": combo_count,
        "combinations": combos,
        "big_per_unit": big_amount,
        "small_per_unit": small_amount,
        "total_big": total_big,
        "total_small": total_small,
        "total_stake": grand_total
    }

def evaluate_bet_winnings(
    bet_number: str,
    big_stake: int,
    small_stake: int,
    draw_results: Dict[str, Any],
    bet_type: str = "ordinary"
) -> Dict[str, Any]:
    """
    Evaluates winning matches and calculates payout using Singapore 4D Standard Multipliers:
    - 1st Prize (ပထမဆု): 2,000x
    - 2nd Prize (ဒုတိယဆု): 1,000x
    - 3rd Prize (တတိယဆု): 500x
    - Starter Prize (ဆုကြီး ၃ ဆုနီးပါး/ဆုကြီး): 100x
    - Consolation Prize (ဆုသေး): 30x
    - Permutation / Box Roll (ဆုကြီး ၃ ဆု၏ ပတ်လည်): 10x
    """
    first = draw_results.get("first_prize")
    second = draw_results.get("second_prize")
    third = draw_results.get("third_prize")
    starters = draw_results.get("starter_prizes", [])
    cons = draw_results.get("consolidation_prizes", [])
    
    matches = []
    total_payout = 0
    effective_stake = big_stake + small_stake
    
    # 1. First Prize (2,000x)
    if bet_number == first:
        payout = effective_stake * settings.PAYOUT_MULTIPLIERS["first_prize"]
        matches.append({"prize_tier": "1st Prize (ပထမဆု)", "multiplier": 2000, "payout": payout})
        total_payout += payout
        
    # 2. Second Prize (1,000x)
    elif bet_number == second:
        payout = effective_stake * settings.PAYOUT_MULTIPLIERS["second_prize"]
        matches.append({"prize_tier": "2nd Prize (ဒုတိယဆု)", "multiplier": 1000, "payout": payout})
        total_payout += payout
        
    # 3. Third Prize (500x)
    elif bet_number == third:
        payout = effective_stake * settings.PAYOUT_MULTIPLIERS["third_prize"]
        matches.append({"prize_tier": "3rd Prize (တတိယဆု)", "multiplier": 500, "payout": payout})
        total_payout += payout
        
    # 4. Starter Prize (100x)
    elif bet_number in starters:
        payout = effective_stake * settings.PAYOUT_MULTIPLIERS["starter_prize"]
        matches.append({"prize_tier": "Starter Prize (အထူးဆု - ၁၀ ဆု)", "multiplier": 100, "payout": payout})
        total_payout += payout
        
    # 5. Consolation Prize (30x)
    elif bet_number in cons:
        payout = effective_stake * settings.PAYOUT_MULTIPLIERS["consolation_prize"]
        matches.append({"prize_tier": "Consolation Prize (နှစ်သိမ့်ဆု - ၁၀ ဆု)", "multiplier": 30, "payout": payout})
        total_payout += payout
        
    # 6. Permutation / Box Roll Prize (10x)
    # If this ticket was placed as Box/Roll, and the number is a permutation of 1st, 2nd, or 3rd prize
    if (bet_type or "").lower() in ["box", "permutation", "roll", "r", "s", "series"] and total_payout == 0:
        top_3 = [first, second, third]
        bet_sorted = sorted(list(bet_number))
        for idx, prize_num in enumerate(top_3):
            if prize_num and sorted(list(prize_num)) == bet_sorted and bet_number != prize_num:
                payout = effective_stake * settings.PAYOUT_MULTIPLIERS["box_roll_prize"]
                matches.append({
                    "prize_tier": f"Permutation Roll (ပတ်လည် {idx+1} ဆု)",
                    "multiplier": 10,
                    "payout": payout
                })
                total_payout += payout
                break

    return {
        "is_won": total_payout > 0,
        "matches": matches,
        "total_payout": total_payout
    }
