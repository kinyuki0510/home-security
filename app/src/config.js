const config = {
  anthropic: {
    apiKey: import.meta.env.VITE_ANTHROPIC_KEY
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_KEY,
  }
}

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_KEY",
];

required.forEach(key => {
  if (!import.meta.env[key]) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
});

export default config