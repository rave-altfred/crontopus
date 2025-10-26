"""
Validation utilities for jobs and schedules.
"""
import re
from typing import Optional


def validate_cron_expression(expression: str) -> tuple[bool, Optional[str]]:
    """
    Validate a cron expression.
    
    Supports standard 5-field cron expressions:
    - Minute (0-59)
    - Hour (0-23)
    - Day of month (1-31)
    - Month (1-12)
    - Day of week (0-6, 0=Sunday)
    
    Also supports special characters: * , - /
    
    Args:
        expression: Cron expression string
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Examples:
        >>> validate_cron_expression("0 * * * *")
        (True, None)
        >>> validate_cron_expression("0 0 * * 0")
        (True, None)
        >>> validate_cron_expression("invalid")
        (False, "Invalid cron expression format")
    """
    if not expression or not expression.strip():
        return False, "Cron expression cannot be empty"
    
    parts = expression.strip().split()
    
    # Must have exactly 5 fields
    if len(parts) != 5:
        return False, "Cron expression must have exactly 5 fields (minute hour day month weekday)"
    
    # Define valid ranges for each field
    ranges = [
        (0, 59, "minute"),    # minute
        (0, 23, "hour"),      # hour
        (1, 31, "day"),       # day of month
        (1, 12, "month"),     # month
        (0, 6, "weekday"),    # day of week
    ]
    
    for i, (part, (min_val, max_val, field_name)) in enumerate(zip(parts, ranges)):
        # Allow wildcards
        if part == "*":
            continue
        
        # Allow ranges (e.g., 1-5)
        if "-" in part:
            try:
                start, end = part.split("-")
                start, end = int(start), int(end)
                if start < min_val or end > max_val or start > end:
                    return False, f"Invalid range in {field_name} field: {part}"
            except ValueError:
                return False, f"Invalid range format in {field_name} field: {part}"
            continue
        
        # Allow lists (e.g., 1,3,5)
        if "," in part:
            try:
                values = [int(v) for v in part.split(",")]
                if any(v < min_val or v > max_val for v in values):
                    return False, f"Invalid value in {field_name} field: {part}"
            except ValueError:
                return False, f"Invalid list format in {field_name} field: {part}"
            continue
        
        # Allow step values (e.g., */5)
        if "/" in part:
            try:
                base, step = part.split("/")
                if base != "*":
                    base_val = int(base)
                    if base_val < min_val or base_val > max_val:
                        return False, f"Invalid base value in {field_name} field: {part}"
                step_val = int(step)
                if step_val <= 0:
                    return False, f"Step value must be positive in {field_name} field: {part}"
            except ValueError:
                return False, f"Invalid step format in {field_name} field: {part}"
            continue
        
        # Must be a valid integer in range
        try:
            value = int(part)
            if value < min_val or value > max_val:
                return False, f"Value {value} out of range for {field_name} (must be {min_val}-{max_val})"
        except ValueError:
            return False, f"Invalid value in {field_name} field: {part}"
    
    return True, None
