// Name to show for a user: full name when set, otherwise the username
export const displayName = (user) => user?.full_name || user?.username || 'Someone';

// "friend" / "friends"; pass the plural form when it isn't word + "s"
export const pluralWord = (n, word, many = `${word}s`) => (Number(n) === 1 ? word : many);

// "1 friend", "3 friends"
export const plural = (n, word, many) => `${n} ${pluralWord(n, word, many)}`;
