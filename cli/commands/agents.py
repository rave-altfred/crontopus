"""
Agent management commands.

List, view, and manage Crontopus agents.
"""
import click
from datetime import datetime

from core.api_client import api_client
from core.formatter import print_table, print_json, print_error, print_info, print_success


@click.group()
def agents():
    """Manage Crontopus agents."""
    pass


@agents.command(name="list")
@click.option('--page', '-p', default=1, type=int, help='Page number')
@click.option('--page-size', '-s', default=20, type=int, help='Items per page')
@click.option('--status', help='Filter by status (active, inactive, offline)')
@click.option('--json', 'output_json', is_flag=True, help='Output as JSON')
def list_agents(page: int, page_size: int, status: str, output_json: bool):
    """
    List all enrolled agents.
    
    Examples:
        crontopus agents list
        crontopus agents list --page 2
        crontopus agents list --status active
        crontopus agents list --json
    """
    # Build query parameters
    params = {
        'page': page,
        'page_size': page_size
    }
    
    if status:
        params['status'] = status
    
    try:
        response = api_client.get('/api/agents', params=params)
        data = response.json()
        
        if output_json:
            print_json(data)
            return
        
        agents = data.get('agents', [])
        total = data.get('total', 0)
        
        if not agents:
            print_info("No agents found")
            return
        
        # Format data for table display
        table_data = []
        for agent in agents:
            # Format last heartbeat
            last_heartbeat = agent.get('last_heartbeat', '')
            if last_heartbeat:
                try:
                    dt = datetime.fromisoformat(last_heartbeat.replace('Z', '+00:00'))
                    last_heartbeat = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    pass
            
            # Format enrolled_at
            enrolled_at = agent.get('enrolled_at', '')
            if enrolled_at:
                try:
                    dt = datetime.fromisoformat(enrolled_at.replace('Z', '+00:00'))
                    enrolled_at = dt.strftime('%Y-%m-%d %H:%M')
                except:
                    pass
            
            table_data.append({
                'ID': agent.get('id', '-'),
                'Name': agent.get('name', '-'),
                'Hostname': agent.get('hostname', '-'),
                'Platform': agent.get('platform', '-'),
                'Status': agent.get('status', '-'),
                'Last Heartbeat': last_heartbeat or 'Never',
                'Enrolled': enrolled_at
            })
        
        # Print table
        columns = ['ID', 'Name', 'Hostname', 'Platform', 'Status', 'Last Heartbeat', 'Enrolled']
        title = f"Enrolled Agents (Page {page}/{(total + page_size - 1) // page_size}, Total: {total})"
        print_table(table_data, columns, title=title)
        
    except Exception as e:
        print_error(f"Failed to fetch agents: {e}")


@agents.command(name="show")
@click.argument('agent_id', type=int)
@click.option('--json', 'output_json', is_flag=True, help='Output as JSON')
def show_agent(agent_id: int, output_json: bool):
    """
    Show detailed information about a specific agent.
    
    Examples:
        crontopus agents show 1
        crontopus agents show 1 --json
    """
    try:
        response = api_client.get(f'/api/agents/{agent_id}')
        data = response.json()
        
        if output_json:
            print_json(data)
            return
        
        # Display agent details
        print(f"\n{'='*60}")
        print(f"Agent ID: {data.get('id')}")
        print(f"{'='*60}\n")
        
        print(f"Name:         {data.get('name', '-')}")
        print(f"Hostname:     {data.get('hostname', '-')}")
        print(f"Platform:     {data.get('platform', '-')}")
        print(f"Version:      {data.get('version', '-')}")
        print(f"Status:       {data.get('status', '-')}")
        print(f"Tenant ID:    {data.get('tenant_id', '-')}")
        
        # Git configuration
        git_repo = data.get('git_repo_url')
        git_branch = data.get('git_branch')
        if git_repo or git_branch:
            print(f"\n{'Git Configuration':-^60}")
            print(f"Repository:   {git_repo or 'Not configured'}")
            print(f"Branch:       {git_branch or 'main'}")
        
        # Timing information
        print(f"\n{'Timing':-^60}")
        enrolled = data.get('enrolled_at', '-')
        last_heartbeat = data.get('last_heartbeat', '-')
        
        if enrolled:
            try:
                dt = datetime.fromisoformat(enrolled.replace('Z', '+00:00'))
                enrolled = dt.strftime('%Y-%m-%d %H:%M:%S %Z')
            except:
                pass
        
        if last_heartbeat:
            try:
                dt = datetime.fromisoformat(last_heartbeat.replace('Z', '+00:00'))
                last_heartbeat = dt.strftime('%Y-%m-%d %H:%M:%S %Z')
            except:
                pass
        
        print(f"Enrolled:     {enrolled}")
        print(f"Last Heartbeat: {last_heartbeat}")
        
        print(f"\n{'='*60}\n")
        
    except Exception as e:
        print_error(f"Failed to fetch agent details: {e}")


@agents.command(name="revoke")
@click.argument('agent_id', type=int)
@click.option('--yes', '-y', is_flag=True, help='Skip confirmation prompt')
def revoke_agent(agent_id: int, yes: bool):
    """
    Revoke an agent's credentials and remove it from the system.
    
    This will delete the agent and prevent it from enrolling again
    with the same credentials.
    
    Examples:
        crontopus agents revoke 1
        crontopus agents revoke 1 --yes
    """
    try:
        # Get agent details first
        response = api_client.get(f'/api/agents/{agent_id}')
        agent = response.json()
        
        agent_name = agent.get('name', f'Agent {agent_id}')
        
        # Confirm deletion
        if not yes:
            click.confirm(
                f"Are you sure you want to revoke agent '{agent_name}' (ID: {agent_id})?\n"
                f"This action cannot be undone.",
                abort=True
            )
        
        # Delete agent
        api_client.delete(f'/api/agents/{agent_id}')
        print_success(f"Agent '{agent_name}' (ID: {agent_id}) has been revoked")
        
    except click.Abort:
        print_info("Revocation cancelled")
    except Exception as e:
        print_error(f"Failed to revoke agent: {e}")