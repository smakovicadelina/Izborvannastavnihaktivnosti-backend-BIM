
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    "Nedostaju Supabase promenljive u .env fajlu."
  );
}

const opcije = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
};

const authSupabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  opcije
);

const dbSupabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  opcije
);

function createUserSupabase(accessToken) {
  if (
    typeof accessToken !== "string" ||
    !accessToken.trim()
  ) {
    throw new Error("Pristupni token je obavezan.");
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      ...opcije,
      global: {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`
        }
      }
    }
  );
}

module.exports = {
  authSupabase,
  dbSupabase,
  createUserSupabase
};
