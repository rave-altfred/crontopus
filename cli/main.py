#!/usr/bin/env python3
"""
Crontopus CLI - Command-line interface for Crontopus job scheduling platform.

Main entry point for the CLI application.
"""
import click

from commands.auth import auth


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


if __name__ == "__main__":
    cli()