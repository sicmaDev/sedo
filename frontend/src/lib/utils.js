export const formatFCFA = (amount) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
};

export const scoreLevel = (score) => {
  if (score >= 76) return { label: 'Éligible au crédit', color: 'green', badge: 'bg-green-100 text-green-700' };
  if (score >= 56) return { label: 'Presque éligible', color: 'yellow', badge: 'bg-yellow-100 text-yellow-700' };
  if (score >= 31) return { label: 'En progression', color: 'orange', badge: 'bg-orange-100 text-orange-700' };
  return { label: 'Non éligible', color: 'red', badge: 'bg-red-100 text-red-700' };
};

export const scoreColor = (score) => {
  if (score >= 75) return 'text-green-600 bg-green-50';
  if (score >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

export const timeSince = (dateStr) => {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'À l\'instant';
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
  return `Il y a ${Math.floor(seconds / 86400)}j`;
};
