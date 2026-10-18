export const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('sg4d_api_base');
    if (custom) return custom;

    const isMobileApp = Boolean(
      window.Capacitor || 
      window.location.protocol === 'capacitor:' || 
      window.location.protocol === 'file:' || 
      (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443')) ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173')
    );

    if (isMobileApp) {
      return 'https://sg4dmm.onrender.com/api';
    }
  }
  return '/api';
};

export const API_BASE = getApiBase();

export const apiClient = {
  getToken() {
    return localStorage.getItem('sg4d_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('sg4d_token', token);
    } else {
      localStorage.removeItem('sg4d_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = { ...options.headers };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const base = getApiBase();
    const res = await fetch(`${base}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.detail || data.message || 'Request failed';
      throw new Error(errorMsg);
    }
    return data;
  },

  // Auth & Referral Code Enforcement
  login(identifier, password, referralCode = '') {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ 
        identifier: identifier, 
        phone: identifier,
        username: identifier,
        password, 
        referral_code: referralCode 
      }),
    });
  },

  register(phone, fullName, password, countryCode = '+95', referralCode, username = '') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ 
        phone, 
        full_name: fullName, 
        username: username || fullName,
        password, 
        country_code: countryCode,
        referral_code: referralCode 
      }),
    });
  },

  requestTelegramOtp(phone, purpose = 'register') {
    return this.request('/auth/telegram/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose }),
    });
  },

  verifyTelegramOtp(phone, code) {
    return this.request('/auth/telegram/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  },

  resetPassword(phone, otpCode, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        phone, 
        otp_code: otpCode, 
        new_password: newPassword 
      }),
    });
  },

  verifyAgentCode(code) {
    return this.request(`/auth/verify-agent-code/${encodeURIComponent(code)}`);
  },

  getProfile() {
    return this.request('/auth/me');
  },

  // Bets
  calculateStake(items) {
    return this.request('/bets/calculate', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  getActiveDraw() {
    return this.request('/bets/active-draw');
  },

  getAvailableDraws() {
    return this.request('/bets/available-draws');
  },

  placeBet(drawIdOrIds, items) {
    const payload = { items };
    if (Array.isArray(drawIdOrIds)) {
      payload.draw_ids = drawIdOrIds;
    } else {
      payload.draw_id = drawIdOrIds;
    }
    return this.request('/bets/place', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBetHistory(statusFilter = '') {
    const url = statusFilter ? `/bets/my-history?status_filter=${statusFilter}` : '/bets/my-history';
    return this.request(url);
  },

  // Payments & Auto-Verification
  getReceivers() {
    return this.request('/payments/receivers');
  },

  uploadSlip(formData) {
    return this.request('/payments/upload-slip', {
      method: 'POST',
      body: formData,
    });
  },

  submitDeposit(payload) {
    return this.request('/payments/deposit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitWithdrawal(payload) {
    return this.request('/payments/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },

  getMyTransactions() {
    return this.request('/payments/my-transactions');
  },

  // Lottery Results & Singapore Pools Live Sync
  getDraws() {
    return this.request('/lottery/draws');
  },

  syncSingaporePools(targetDate = null) {
    const url = targetDate ? `/lottery/sync-sgpools?target_date=${targetDate}` : '/lottery/sync-sgpools';
    return this.request(url, { method: 'POST' });
  },

  getSgPoolsLiveFeed() {
    return this.request('/lottery/sgpools-live');
  },

  getRecentWinners(limit = 25) {
    return this.request(`/lottery/recent-winners?limit=${limit}`);
  },

  // Notifications
  getNotifications() {
    return this.request('/notifications/my');
  },

  markNotificationsRead(notifIds = []) {
    return this.request('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notif_ids: notifIds }),
    });
  },

  markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST',
    });
  },

  // Admin & Financial Ledger
  getFinancialOverview() {
    return this.request('/admin/financial-overview');
  },

  getLedgerEntries(entryType = '') {
    const url = entryType ? `/admin/ledger-entries?entry_type=${entryType}` : '/admin/ledger-entries';
    return this.request(url);
  },

  getDailySummaries() {
    return this.request('/admin/daily-summaries');
  },

  getWeeklyBonuses() {
    return this.request('/admin/weekly-bonuses');
  },

  triggerWeeklyBonus() {
    return this.request('/admin/trigger-weekly-bonus', {
      method: 'POST',
    });
  },

  getFlaggedTransactions() {
    return this.request('/admin/flagged-transactions');
  },

  resolveTransaction(txId, action, notes = '') {
    return this.request(`/admin/resolve-transaction/${txId}?action=${action}&review_notes=${encodeURIComponent(notes)}`, {
      method: 'POST',
    });
  },

  triggerArchiving(retentionDays = 90) {
    return this.request(`/admin/trigger-archiving?retention_days=${retentionDays}`, {
      method: 'POST',
    });
  },

  getArchiveStats() {
    return this.request('/admin/archive-stats');
  },

  getHealth() {
    return this.request('/health');
  },

  // --------------------------------------------------------------------------
  // Multi-View Admin Portal API Methods
  // --------------------------------------------------------------------------
  getAdminCompanyBalance() {
    return this.request('/admin/company-balance');
  },

  getAdmin4DGame(drawId = null, mode = 'live') {
    const params = new URLSearchParams();
    if (drawId) params.append('draw_id', drawId);
    if (mode) params.append('mode', mode);
    const q = params.toString();
    const url = q ? `/admin/4d/game?${q}` : '/admin/4d/game';
    return this.request(url);
  },

  getAdminHeatmap(drawId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/heatmap/${drawId}?${q}`);
  },

  addAdminClosedNumber(payload) {
    return this.request('/admin/4d/closed-numbers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteAdminClosedNumber(number, drawId = null) {
    const q = drawId ? `?draw_id=${drawId}` : '';
    return this.request(`/admin/4d/closed-numbers/${encodeURIComponent(number)}${q}`, {
      method: 'DELETE',
    });
  },

  getAdmin4DNumberAudit(number, drawId = null) {
    const q = drawId ? `?draw_id=${drawId}` : '';
    return this.request(`/admin/4d/number-audit/${encodeURIComponent(number)}${q}`);
  },

  getAdmin4DBets(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/4d/bets?${q}`);
  },

  getAdminTopUps(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/top-ups?${q}`);
  },

  resolveAdminTransaction(txId, action, reviewNotes = '') {
    return this.request(`/admin/resolve-transaction/${txId}?action=${action}&review_notes=${encodeURIComponent(reviewNotes)}`, {
      method: 'POST',
    });
  },

  revertAdminDeposit(txId, reason = '') {
    return this.request(`/admin/deposits/${txId}/revert?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },

  restoreAdminDeposit(txId, reason = '') {
    return this.request(`/admin/deposits/${txId}/restore?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },

  unrevertAdminDeposit(txId, reason = '') {
    return this.restoreAdminDeposit(txId, reason);
  },

  getAdminWithdrawals(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/withdrawals?${q}`);
  },

  acceptAdminWithdrawal(id, payload = {}) {
    return this.request(`/admin/withdrawals/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  rejectAdminWithdrawal(id, payload = '') {
    const reasonText = typeof payload === 'string' ? payload : (payload?.reason || '');
    const q = reasonText ? `?reason=${encodeURIComponent(reasonText)}` : '';
    return this.request(`/admin/withdrawals/${id}/reject${q}`, {
      method: 'POST',
      body: JSON.stringify({ reason: reasonText }),
    });
  },

  revertAdminWithdrawal(id) {
    return this.request(`/admin/withdrawals/${id}/revert`, {
      method: 'POST',
    });
  },

  getAdminSystemUsers() {
    return this.request('/admin/members/system-users');
  },

  createAdminSystemUser(payload) {
    return this.request('/admin/members/system-users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAdminSystemUser(id, payload) {
    return this.request(`/admin/members/system-users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  manualAgentLevelUp(userId, payload) {
    return this.request(`/admin/members/system-users/${userId}/level-up`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAdminAgentLevelLogs(agentId = null) {
    const q = agentId ? `?agent_id=${agentId}` : '';
    return this.request(`/admin/members/system-users/level-logs${q}`);
  },

  getAdminAppUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/members/app-users?${q}`);
  },

  toggleAdminAppUserStatus(userId) {
    return this.request(`/admin/members/app-users/${userId}/toggle-status`, {
      method: 'POST',
    });
  },

  adjustAdminAppUserBalance(userId, payload) {
    return this.request(`/admin/members/app-users/${userId}/adjust-balance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAdminAppUserProfile(userId, payload) {
    return this.request(`/admin/members/app-users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getAdminFakeUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/members/fake-users${q ? `?${q}` : ''}`);
  },

  createAdminFakeUser(payload) {
    return this.request('/admin/members/fake-users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteAdminFakeUser(id) {
    return this.request(`/admin/members/fake-users/${id}`, {
      method: 'DELETE',
    });
  },

  getAdminStatements(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/reports/statements?${q}`);
  },

  getAdminFinancialReport(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/reports/financial?${q}`);
  },

  getAdminDrawStatements(limit = 50) {
    return this.request(`/admin/reports/4d-bets?limit=${limit}`);
  },

  getAdmin4DBetsReport(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/reports/4d-bets?${q}`);
  },

  getAdminUserBetsReport(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/reports/user-bets?${q}`);
  },

  getAdminAgentsReport() {
    return this.request('/admin/reports/agents');
  },

  getAdminSystemSettings() {
    return this.request('/admin/settings/system');
  },

  updateAdminSystemSettings(payload) {
    return this.request('/admin/settings/system', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  uploadAdminPaymentQr(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/admin/settings/upload-qr', {
      method: 'POST',
      body: formData,
    });
  },

  toggleAdminAgentCredit(enabled = null) {
    return this.request('/admin/settings/toggle-agent-credit', {
      method: 'POST',
      body: JSON.stringify(enabled !== null ? { enabled } : {}),
    });
  },

  getAdminApplications() {
    return this.request('/admin/settings/applications');
  },

  createAdminApplication(payload) {
    return this.request('/admin/settings/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAdminNotifications(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/notifications?${q}`);
  },

  createAdminNotification(payload) {
    return this.request('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAdminAgentCommissions(agentId = null, limit = 100) {
    const url = agentId 
      ? `/admin/agent-commissions?agent_id=${agentId}&limit=${limit}`
      : `/admin/agent-commissions?limit=${limit}`;
    return this.request(url);
  },

  getAdminAgentDetails(agentId) {
    return this.request(`/admin/agents/${agentId}/details`);
  },

  toggleAdminAgentLock(agentId) {
    return this.request(`/admin/agents/${agentId}/toggle-lock`, {
      method: 'POST',
    });
  },

  getAdminWeeklyBonuses(limit = 50) {
    return this.request(`/admin/weekly-bonuses?limit=${limit}`);
  },

  getAdminWeeklyBonusesPreview() {
    return this.request('/admin/weekly-bonuses/preview');
  },

  getAdminWeeklyBonusRules() {
    return this.request('/admin/weekly-bonuses/rules');
  },

  updateAdminWeeklyBonusRules(payload) {
    return this.request('/admin/weekly-bonuses/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  triggerAdminWeeklyBonus() {
    return this.request('/admin/trigger-weekly-bonus', {
      method: 'POST',
    });
  },

  triggerAdminWeeklySettlement() {
    return this.request('/admin/trigger-weekly-settlement', {
      method: 'POST',
    });
  },

  clearAdminAgentSettlement(agentId, note = 'Debt cleared by Admin') {
    return this.request(`/admin/agents/${agentId}/clear-settlement?note=${encodeURIComponent(note)}`, {
      method: 'POST',
    });
  },

  updateAdminAgentCredit(agentId, payload) {
    return this.request(`/admin/agents/${agentId}/update-credit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createAdminAgent(payload) {
    return this.request('/admin/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAgentSummary() {
    return this.request('/auth/agent-summary');
  },

  getAdminDashboardStats() {
    return this.request('/admin/dashboard-stats');
  }
};

