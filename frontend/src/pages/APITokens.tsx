import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Key, Trash2, Plus, Copy, Clock, Shield, Code } from 'lucide-react';
import { apiTokensApi, AVAILABLE_SCOPES, type APIToken, type APITokenCreateResponse } from '../api/apiTokens';

export function APITokens() {
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [newToken, setNewToken] = useState<APITokenCreateResponse | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:runs']);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10;

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const data = await apiTokensApi.list();
      setTokens(data.tokens);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      alert('Please enter a token name');
      return;
    }

    if (selectedScopes.length === 0) {
      alert('Please select at least one scope');
      return;
    }

    setCreatingToken(true);
    try {
      const response = await apiTokensApi.create({
        name: tokenName.trim(),
        scopes: selectedScopes,
        expires_days: expiresInDays,
      });
      
      setNewToken(response);
      setTokenName('');
      setExpiresInDays(undefined);
      setSelectedScopes(['read:runs']);
      setShowCreateForm(false);
      await loadTokens();
    } catch (error) {
      console.error('Failed to create token:', error);
      alert('Failed to create API token. Please try again.');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"? This cannot be undone and the token will immediately stop working.`)) return;

    try {
      await apiTokensApi.delete(id);
      await loadTokens();
    } catch (error) {
      console.error('Failed to delete token:', error);
      alert('Failed to revoke token. Please try again.');
    }
  };

  const handleToggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      // If selecting admin:*, deselect all others
      if (scope === 'admin:*') {
        setSelectedScopes(['admin:*']);
      } else {
        // If selecting anything else, remove admin:* if present
        const newScopes = selectedScopes.filter(s => s !== 'admin:*');
        setSelectedScopes([...newScopes, scope]);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Token copied to clipboard!');
  };

  // Pagination logic
  const sortedTokens = [...tokens].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalPages = Math.ceil(sortedTokens.length / tokensPerPage);
  const paginatedTokens = sortedTokens.slice(
    (currentPage - 1) * tokensPerPage,
    currentPage * tokensPerPage
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">API Tokens</h1>
        <p className="text-gray-600 dark:text-[#f8f8f2]">
          Create API tokens for programmatic access to Crontopus. Use these for CI/CD, automation scripts, and external integrations.
        </p>
      </div>

      {/* New Token Display - Show at top if exists */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Token Created Successfully!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                ⚠️ <strong>IMPORTANT:</strong> Copy this token now - it will never be shown again!
              </p>
              <div className="bg-white dark:bg-[#44475a] rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-[#6272a4]">Token</span>
                  <button
                    onClick={() => copyToClipboard(newToken.token)}
                    className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono text-sm break-all border border-gray-200 dark:border-gray-700">
                  <code className="text-gray-800 dark:text-gray-200">{newToken.token}</code>
                </div>
              </div>
              <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                <div><strong>Name:</strong> {newToken.name}</div>
                <div><strong>Scopes:</strong> {newToken.scopes.join(', ')}</div>
                <div><strong>Expires:</strong> {newToken.expires_at ? new Date(newToken.expires_at).toLocaleDateString() : 'Never'}</div>
              </div>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Create Token Section */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Generate New Token</h2>
            <p className="text-sm text-gray-600 dark:text-[#6272a4] mt-1">
              Create a token for CI/CD pipelines, scripts, or external tools
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? 'Cancel' : 'New Token'}
          </button>
        </div>

        {/* Create Token Form */}
        {showCreateForm && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <div className="space-y-4">
              {/* Token Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
                  Token Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., GitHub Actions CI, Monitoring Dashboard"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
                  Expiration
                </label>
                <select
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Never expires</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-[#6272a4] mt-1">
                  Recommended: Set expiration for security. Tokens without expiration never expire.
                </p>
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
                  Permissions (Scopes) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                        selectedScopes.includes(scope.value)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => handleToggleScope(scope.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{scope.label}</div>
                        <div className="text-xs text-gray-600 dark:text-[#6272a4]">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-[#6272a4] mt-2">
                  Select the minimum permissions needed. Admin grants all permissions.
                </p>
              </div>

              {/* Create Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateToken}
                  disabled={creatingToken}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingToken ? 'Creating...' : 'Create Token'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-[#f8f8f2] font-medium rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tokens List */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your API Tokens</h2>
        </div>

        {loadingTokens ? (
          <div className="text-gray-600 dark:text-[#6272a4] text-center py-8">Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-600 dark:text-[#6272a4] mb-4">
              No API tokens yet. Create one to get started with programmatic access.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedTokens.map((token) => (
                <div
                  key={token.id}
                  className={`border rounded-lg p-4 ${
                    token.is_expired
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{token.name}</h3>
                        {token.is_expired && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                            Expired
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-1 text-gray-500 dark:text-[#6272a4] mb-1">
                            <Shield className="w-4 h-4" />
                            <span className="font-medium">Scopes</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {token.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-1 text-gray-500 dark:text-[#6272a4] mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">Last Used</span>
                          </div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-1 text-gray-500 dark:text-[#6272a4] mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">Expires</span>
                          </div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-[#6272a4] mt-2">
                        Created {new Date(token.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteToken(token.id, token.name)}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2"
                      title="Revoke token"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-[#6272a4]">
                <div className="text-sm text-gray-600 dark:text-[#6272a4]">
                  Showing {(currentPage - 1) * tokensPerPage + 1} to {Math.min(currentPage * tokensPerPage, sortedTokens.length)} of {sortedTokens.length} tokens
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2]"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      // Show first page, last page, and pages around current
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded ${
                            currentPage === page
                              ? 'bg-blue-500 text-white'
                              : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-[#f8f8f2]'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Usage Example */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Code className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Usage Example</h2>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-[#6272a4] mb-4">
          Use your API token to authenticate requests to the Crontopus API:
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
          <code className="text-gray-800 dark:text-gray-200">
            curl https://crontopus.com/api/runs \<br />
            &nbsp;&nbsp;-H "Authorization: Bearer ctp_your_token_here"
          </code>
        </div>
      </div>

      {/* Security Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Security Best Practices
            </h3>
            <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
              <li>Treat API tokens like passwords - never share them</li>
              <li>Use environment variables to store tokens in your scripts</li>
              <li>Do not commit tokens to version control (.gitignore them)</li>
              <li>Set expiration dates for tokens when possible</li>
              <li>Use minimum required scopes (principle of least privilege)</li>
              <li>Revoke unused tokens immediately</li>
              <li>Rotate tokens regularly for long-running applications</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
