"""
Run history commands.

View job execution history and details.
"""
import click
from datetime import datetime

from core.api_client import api_client
from core.formatter import print_table, print_json, print_error, print_info


@click.group()
def runs():
    """View job run history."""
    pass


@runs.command(name="list")
@click.option('--page', '-p', default=1, type=int, help='Page number')
@click.option('--page-size', '-s', default=20, type=int, help='Items per page')
@click.option('--job-name', '-j', help='Filter by job name')
@click.option('--status', help='Filter by status (running, success, failure, timeout, cancelled)')
@click.option('--json', 'output_json', is_flag=True, help='Output as JSON')
def list_runs(page: int, page_size: int, job_name: str, status: str, output_json: bool):
    """
    List job run history.
    
    Examples:
        crontopus runs list
        crontopus runs list --page 2
        crontopus runs list --job-name backup-db
        crontopus runs list --status success
        crontopus runs list --json
    """
    # Build query parameters
    params = {
        'page': page,
        'page_size': page_size
    }
    
    if job_name:
        params['job_name'] = job_name
    
    if status:
        params['status'] = status
    
    try:
        response = api_client.get('/api/runs', params=params)
        data = response.json()
        
        if output_json:
            print_json(data)
            return
        
        runs = data.get('runs', [])
        total = data.get('total', 0)
        
        if not runs:
            print_info("No runs found")
            return
        
        # Format data for table display
        table_data = []
        for run in runs:
            # Format datetime
            started_at = run.get('started_at', '')
            if started_at:
                try:
                    dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                    started_at = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    pass
            
            # Calculate duration display
            duration = run.get('duration')
            duration_str = f"{duration}s" if duration else "-"
            
            table_data.append({
                'ID': run.get('id', '-'),
                'Job Name': run.get('job_name', '-'),
                'Status': run.get('status', '-'),
                'Started': started_at,
                'Duration': duration_str,
                'Exit Code': run.get('exit_code', '-') if run.get('exit_code') is not None else '-'
            })
        
        # Print table
        columns = ['ID', 'Job Name', 'Status', 'Started', 'Duration', 'Exit Code']
        title = f"Job Runs (Page {page}/{(total + page_size - 1) // page_size}, Total: {total})"
        print_table(table_data, columns, title=title)
        
    except Exception as e:
        print_error(f"Failed to fetch runs: {e}")


@runs.command(name="show")
@click.argument('run_id', type=int)
@click.option('--json', 'output_json', is_flag=True, help='Output as JSON')
def show_run(run_id: int, output_json: bool):
    """
    Show detailed information about a specific run.
    
    Examples:
        crontopus runs show 123
        crontopus runs show 123 --json
    """
    try:
        response = api_client.get(f'/api/runs/{run_id}')
        data = response.json()
        
        if output_json:
            print_json(data)
            return
        
        # Display run details
        print(f"\n{'='*60}")
        print(f"Run ID: {data.get('id')}")
        print(f"{'='*60}\n")
        
        print(f"Job Name:     {data.get('job_name', '-')}")
        print(f"Tenant:       {data.get('tenant_id', '-')}")
        print(f"Status:       {data.get('status', '-')}")
        print(f"Agent ID:     {data.get('agent_id', '-') or 'N/A'}")
        
        # Timing information
        print(f"\n{'Timing':-^60}")
        started = data.get('started_at', '-')
        finished = data.get('finished_at', '-')
        duration = data.get('duration')
        
        if started:
            try:
                dt = datetime.fromisoformat(started.replace('Z', '+00:00'))
                started = dt.strftime('%Y-%m-%d %H:%M:%S %Z')
            except:
                pass
        
        if finished:
            try:
                dt = datetime.fromisoformat(finished.replace('Z', '+00:00'))
                finished = dt.strftime('%Y-%m-%d %H:%M:%S %Z')
            except:
                pass
        
        print(f"Started:      {started}")
        print(f"Finished:     {finished}")
        print(f"Duration:     {duration}s" if duration else "Duration:     -")
        
        # Exit information
        exit_code = data.get('exit_code')
        if exit_code is not None:
            print(f"\n{'Exit Information':-^60}")
            print(f"Exit Code:    {exit_code}")
        
        # Output
        output = data.get('output')
        if output:
            print(f"\n{'Output':-^60}")
            print(output)
        
        # Error message
        error = data.get('error_message')
        if error:
            print(f"\n{'Error Message':-^60}")
            print(error)
        
        print(f"\n{'='*60}\n")
        
    except Exception as e:
        print_error(f"Failed to fetch run details: {e}")
