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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">API Tokens</h1>
        <p className="text-gray-600 dark:text-[#f8f8f2] font-mono text-sm">
          // Create API tokens for programmatic access to Crontopus.
        </p>
      </div>

      {/* New Token Display - Show at top if exists */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500 dark:border-green-500 p-6 shadow-none">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-mono font-bold text-green-900 dark:text-green-100 mb-2 uppercase tracking-wide">
                Token Generated
              </h3>
              <p className="text-sm font-mono text-green-800 dark:text-green-200 mb-3">
                WARNING: Copy this token now. It will not be shown again.
              </p>
              <div className="bg-white dark:bg-[#282a36] border border-green-200 dark:border-green-800 p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase">ACCESS_TOKEN</span>
                  <button
                    onClick={() => copyToClipboard(newToken.token)}
                    className="flex items-center gap-1 text-xs font-mono text-green-600 dark:text-green-400 hover:underline uppercase"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="font-mono text-sm break-all text-gray-800 dark:text-[#f8f8f2]">
                  {newToken.token}
                </div>
              </div>
              <div className="text-xs font-mono text-green-700 dark:text-green-300 space-y-1">
                <div><span className="font-bold">NAME:</span> {newToken.name}</div>
                <div><span className="font-bold">SCOPES:</span> [{newToken.scopes.join(', ')}]</div>
                <div><span className="font-bold">EXPIRES:</span> {newToken.expires_at ? new Date(newToken.expires_at).toLocaleDateString() : 'NEVER'}</div>
              </div>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              <span className="font-mono text-xl">×</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Token Section */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono uppercase">Generate New Token</h2>
            <p className="text-xs font-mono text-gray-500 dark:text-[#6272a4] mt-1">
              Create a token for CI/CD pipelines, scripts, or external tools
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? 'Cancel' : 'New Token'}
          </button>
        </div>

        {/* Create Token Form */}
        {showCreateForm && (
          <div className="bg-gray-50 dark:bg-[#21222c] border-t border-gray-200 dark:border-[#44475a] p-6 mt-4 -mx-6 -mb-6">
            <div className="space-y-4">
              {/* Token Name */}
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Token Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., GITHUB_ACTIONS_CI"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] text-gray-900 dark:text-white font-mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Expiration
                </label>
                <select
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] text-gray-900 dark:text-white font-mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">NEVER (NO EXPIRATION)</option>
                  <option value="7">7 DAYS</option>
                  <option value="30">30 DAYS</option>
                  <option value="90">90 DAYS</option>
                  <option value="180">180 DAYS</option>
                  <option value="365">1 YEAR</option>
                </select>
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-2 uppercase tracking-wider">
                  Scopes <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                        selectedScopes.includes(scope.value)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-[#44475a] hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => handleToggleScope(scope.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-mono text-xs font-bold text-gray-900 dark:text-white">{scope.value}</div>
                        <div className="text-xs text-gray-600 dark:text-[#6272a4] mt-0.5">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateToken}
                  disabled={creatingToken}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingToken ? 'CREATING...' : 'CREATE TOKEN'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tokens List */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#44475a] flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono uppercase">Active Tokens</h2>
        </div>

        {loadingTokens ? (
          <div className="text-gray-600 dark:text-[#6272a4] text-center py-8 font-mono text-sm">LOADING TOKENS...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-[#44475a]" />
            <p className="text-gray-600 dark:text-[#6272a4] font-mono text-sm">
              NO TOKENS FOUND
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-[#44475a]">
            {paginatedTokens.map((token) => (
              <div
                key={token.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-[#21222c] transition-colors ${
                  token.is_expired ? 'bg-red-50 dark:bg-red-900/10' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-mono font-bold text-gray-900 dark:text-white text-sm">{token.name}</h3>
                      {token.is_expired && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-mono uppercase border border-red-200 dark:border-red-800">
                          Expired
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                      <div>
                        <div className="text-gray-500 dark:text-[#6272a4] mb-1 uppercase">Scopes</div>
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] border border-gray-200 dark:border-[#6272a4]"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-500 dark:text-[#6272a4] mb-1 uppercase">Last Used</div>
                        <div className="text-gray-700 dark:text-[#f8f8f2]">
                          {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'NEVER'}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-500 dark:text-[#6272a4] mb-1 uppercase">Expires</div>
                        <div className="text-gray-700 dark:text-[#f8f8f2]">
                          {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : 'NEVER'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 dark:text-[#6272a4] mt-2 font-mono">
                      ID: {token.id} • CREATED: {new Date(token.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteToken(token.id, token.name)}
                    className="text-gray-400 hover:text-red-600 dark:text-[#6272a4] dark:hover:text-[#ff5555] p-2"
                    title="Revoke token"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#44475a] flex items-center justify-between">
            <div className="text-xs font-mono text-gray-500 dark:text-[#6272a4]">
              SHOWING {(currentPage - 1) * tokensPerPage + 1}-{Math.min(currentPage * tokensPerPage, sortedTokens.length)} OF {sortedTokens.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2] text-xs font-mono uppercase"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2] text-xs font-mono uppercase"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Example */}
      <div className="bg-gray-900 dark:bg-[#21222c] border border-gray-800 dark:border-[#44475a] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code className="w-4 h-4 text-blue-400" />
          <h2 className="text-lg font-bold text-white font-mono uppercase">Usage Example</h2>
        </div>
        
        <div className="bg-black dark:bg-[#191a21] border border-gray-800 dark:border-[#44475a] p-4 font-mono text-sm text-gray-300">
          <div># Authenticate requests with the token in the Authorization header</div>
          <div className="mt-2 text-green-400">
            curl https://crontopus.com/api/runs \<br />
            &nbsp;&nbsp;-H "Authorization: Bearer ctp_your_token_here"
          </div>
        </div>
      </div>
    </div>
  );
}
