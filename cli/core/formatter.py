"""
Output formatting utilities.

Provides helpers for displaying data in tables, JSON, or plain text.
"""
import json
from typing import Any, Dict, List
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()


def print_json(data: Any) -> None:
    """
    Print data as formatted JSON.
    
    Args:
        data: Data to print (dict, list, or any JSON-serializable object)
    """
    console.print_json(json.dumps(data))


def print_table(data: List[Dict[str, Any]], columns: List[str], title: str = None) -> None:
    """
    Print data as a formatted table.
    
    Args:
        data: List of dictionaries containing row data
        columns: List of column names to display
        title: Optional table title
    """
    if not data:
        console.print("[dim]No data to display[/dim]")
        return
    
    table = Table(title=title, box=box.ROUNDED)
    
    # Add columns
    for col in columns:
        table.add_column(col, style="cyan")
    
    # Add rows
    for row in data:
        values = [str(row.get(col, "")) for col in columns]
        table.add_row(*values)
    
    console.print(table)


def print_success(message: str) -> None:
    """Print a success message."""
    console.print(f"[green]✓[/green] {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    console.print(f"[red]✗[/red] {message}")


def print_info(message: str) -> None:
    """Print an info message."""
    console.print(f"[blue]ℹ[/blue] {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    console.print(f"[yellow]⚠[/yellow] {message}")