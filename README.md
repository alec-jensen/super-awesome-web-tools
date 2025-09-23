# super-awesome-web-tools

privacy focused web tools for the 21st century

https://3ln.me/

## Tools

all tools have the option to be zero knowledge/e2e encrypted

- url shortener
  - this url shortener is intended to be as few characters as possible (hence the domain 3ln.me)
- pastebin
- encrypted text chat
- file drop

## Database (MariaDB)

This project now uses MariaDB for persistence (starting with the URL shortener).

### Configuration

Add a `database` block in `config/config.yaml` (see `config/config.example.yaml`):

```yaml
database:
  host: localhost
  port: 3306
  user: super_awesome_web_tools
  password: super_secure_password
  database: super_awesome_web_tools
```

### Local Development

You can spin up a MariaDB container quickly:

```bash
docker run --name sawt-mariadb -e MARIADB_USER=super_awesome_web_tools \
  -e MARIADB_PASSWORD=super_secure_password \
  -e MARIADB_DATABASE=super_awesome_web_tools \
  -e MARIADB_ROOT_PASSWORD=rootpass \
  -p 3306:3306 -d mariadb:11
```

Or adapt `compose.example.yaml` (add a service) and run with docker compose.

### Schema / Migrations

Currently the URL shortener endpoint lazily creates the `short_links` table if it does not exist:

```sql
CREATE TABLE IF NOT EXISTS short_links (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  short_code VARCHAR(16) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

In the future you should replace this with proper migrations (e.g. using `dbmate`, `drizzle`, or a custom migration script).

### Short Code Generation

Short codes are deterministic and as short as possible:

1. A fixed alphabet of 66 characters: `a-z A-Z 0-9 - _ . ~`.
2. Allocation order enumerates all 1-character codes first (`a` .. `~`), then 2-character codes (`aa`, `ab`, ...), then 3-character, etc. (i.e. variable-length base-66 without leading padding).
3. Freed / deleted codes (future feature) will be inserted into a recycle pool and always reused before creating longer new codes. The smallest available (shortest length, then lexicographically) is chosen.
4. A `code_state` table stores a monotonically increasing `next_index` for fresh allocations; `recycled_codes` stores reusable codes with their length.

Implementation details live in `src/lib/codegen.js` (`allocateCode`, `indexToCode`).

### Environment Overrides

Set `APP_CONFIG_FILE` to point at a custom YAML config. The loader also respects `PORT`, `LOG_LEVEL`, and `BASE_URL` environment variables.

### Health Check

A helper `healthCheck()` is exposed in `src/lib/db.js` which runs `SELECT 1`. You can integrate this into a future `/api/health` endpoint or startup script.
