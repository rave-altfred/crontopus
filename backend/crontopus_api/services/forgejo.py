"""
Forgejo API client for fetching job manifests.
"""
import httpx
import yaml
from typing import List, Dict, Any, Optional
from pathlib import Path


class ForgejoClient:
    """Client for interacting with Forgejo API."""
    
    def __init__(self, base_url: str, username: Optional[str] = None, token: Optional[str] = None):
        """
        Initialize Forgejo client.
        
        Args:
            base_url: Base URL of Forgejo instance (e.g., https://git.crontopus.com)
            username: Optional username for authentication
            token: Optional access token for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.token = token
        
        # Set up auth headers if credentials provided
        self.headers = {}
        if username and token:
            self.headers['Authorization'] = f'token {token}'
    
    async def get_repository_tree(
        self, 
        owner: str, 
        repo: str, 
        branch: str = 'main',
        path: str = ''
    ) -> List[Dict[str, Any]]:
        """
        Get repository file tree.
        
        Args:
            owner: Repository owner
            repo: Repository name
            branch: Branch name
            path: Path within repository
            
        Returns:
            List of file/directory objects
        """
        url = f'{self.base_url}/api/v1/repos/{owner}/{repo}/contents/{path}'
        params = {'ref': branch}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
    
    async def get_file_content(
        self,
        owner: str,
        repo: str,
        file_path: str,
        branch: str = 'main'
    ) -> str:
        """
        Get raw file content.
        
        Args:
            owner: Repository owner
            repo: Repository name
            file_path: Path to file
            branch: Branch name
            
        Returns:
            File content as string
        """
        url = f'{self.base_url}/api/v1/repos/{owner}/{repo}/raw/{file_path}'
        params = {'ref': branch}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.text
    
    async def list_job_manifests(
        self,
        owner: str,
        repo: str,
        branch: str = 'main',
        namespace: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List all job manifests in repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            branch: Branch name
            namespace: Optional namespace filter (e.g., 'production', 'staging')
            
        Returns:
            List of job manifest metadata
        """
        manifests = []
        
        # If namespace specified, only scan that directory
        paths_to_scan = [namespace] if namespace else ['production', 'staging']
        
        for path in paths_to_scan:
            try:
                files = await self.get_repository_tree(owner, repo, branch, path)
                
                for file in files:
                    if file['type'] == 'file' and file['name'].endswith(('.yaml', '.yml')):
                        manifests.append({
                            'name': file['name'],
                            'path': file['path'],
                            'namespace': path,
                            'size': file.get('size', 0),
                            'sha': file.get('sha', ''),
                        })
            except httpx.HTTPStatusError:
                # Directory doesn't exist, skip
                continue
        
        return manifests
    
    async def get_job_manifest(
        self,
        owner: str,
        repo: str,
        file_path: str,
        branch: str = 'main'
    ) -> Dict[str, Any]:
        """
        Get and parse a job manifest.
        
        Args:
            owner: Repository owner
            repo: Repository name
            file_path: Path to manifest file
            branch: Branch name
            
        Returns:
            Parsed job manifest as dict
        """
        content = await self.get_file_content(owner, repo, file_path, branch)
        manifest = yaml.safe_load(content)
        
        # Add metadata
        manifest['_meta'] = {
            'file_path': file_path,
            'namespace': str(Path(file_path).parent),
            'raw_content': content
        }
        
        return manifest
    
    async def validate_manifest(self, manifest: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate job manifest structure.
        
        Args:
            manifest: Parsed manifest dict
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ['apiVersion', 'kind', 'metadata', 'spec']
        
        for field in required_fields:
            if field not in manifest:
                return False, f"Missing required field: {field}"
        
        # Validate metadata
        if 'name' not in manifest.get('metadata', {}):
            return False, "Missing metadata.name"
        
        # Validate spec
        spec = manifest.get('spec', {})
        if 'schedule' not in spec:
            return False, "Missing spec.schedule"
        if 'command' not in spec:
            return False, "Missing spec.command"
        
        return True, None
    
    async def create_or_update_file(
        self,
        owner: str,
        repo: str,
        file_path: str,
        content: str,
        message: str,
        branch: str = 'main',
        author_name: str = 'Crontopus',
        author_email: str = 'bot@crontopus.com'
    ) -> Dict[str, Any]:
        """
        Create or update a file in the repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            file_path: Path to file in repository
            content: File content (will be base64 encoded)
            message: Commit message
            branch: Branch name
            author_name: Commit author name
            author_email: Commit author email
            
        Returns:
            Response from Forgejo API
        """
        import base64
        
        url = f'{self.base_url}/api/v1/repos/{owner}/{repo}/contents/{file_path}'
        
        # Check if file exists to get SHA (required for updates)
        sha = None
        try:
            existing = await self.get_repository_tree(owner, repo, branch, file_path)
            if existing and len(existing) > 0:
                sha = existing[0].get('sha')
        except:
            pass  # File doesn't exist, that's ok for create
        
        # Encode content to base64
        content_encoded = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        
        payload = {
            'content': content_encoded,
            'message': message,
            'branch': branch,
            'author': {
                'name': author_name,
                'email': author_email
            }
        }
        
        # Include SHA for updates
        if sha:
            payload['sha'] = sha
        
        async with httpx.AsyncClient() as client:
            # Use PUT for both create and update (Forgejo API spec)
            response = await client.put(
                url,
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    async def delete_file(
        self,
        owner: str,
        repo: str,
        file_path: str,
        message: str,
        branch: str = 'main',
        author_name: str = 'Crontopus',
        author_email: str = 'bot@crontopus.com'
    ) -> Dict[str, Any]:
        """
        Delete a file from the repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            file_path: Path to file to delete
            message: Commit message
            branch: Branch name
            author_name: Commit author name
            author_email: Commit author email
            
        Returns:
            Response from Forgejo API
        """
        # Get current file SHA (required for delete)
        files = await self.get_repository_tree(owner, repo, branch, file_path)
        if not files or len(files) == 0:
            raise ValueError(f"File not found: {file_path}")
        
        sha = files[0].get('sha')
        if not sha:
            raise ValueError(f"Could not get SHA for file: {file_path}")
        
        url = f'{self.base_url}/api/v1/repos/{owner}/{repo}/contents/{file_path}'
        
        payload = {
            'message': message,
            'branch': branch,
            'sha': sha,
            'author': {
                'name': author_name,
                'email': author_email
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                url,
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
