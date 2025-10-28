#!/usr/bin/env python3
"""
Crontopus CLI - Command-line interface for Crontopus job scheduling platform.

Main entry point for the CLI application.
"""
import click

from commands.auth import auth
from commands.runs import runs
from commands.agents import agents


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """
    Crontopus - GitOps-based job scheduling and monitoring platform.
    
    Manage scheduled jobs, view run history, and monitor agents.
    """
    pass


# Register command groups
cli.add_command(auth)
cli.add_command(runs)
cli.add_command(agents)


if __name__ == "__main__":
    cli()