## create the database if needed (in psql):

# DROP DATABASE org_viz;
# CREATE DATABASE org_viz;

## Connect to that database (in psql)
# \connect org_viz

## Run this DDL in either psql or pgadmin:

DROP TABLE IF EXISTS repo_fingerprints;

DROP TYPE IF EXISTS SEVERITY;

DROP TABLE IF EXISTS fingerprints;

DROP TABLE IF EXISTS repo_snapshots;

CREATE TABLE repo_snapshots (
 id varchar NOT NULL PRIMARY KEY, -- we use the natural key for a repo here which is in this format that we use elsewhere in the wider graph. This allows us to use the repo-id to look into the wider graph and makes things more efficient
 workspace_id varchar NOT NULL,
 provider_id text NOT NULL,
 owner text NOT NULL,
 name text NOT NULL,
 url text NOT NULL,
 branch text,
 path text,
 commit_sha varchar NOT NULL,
 analysis jsonb, -- we should move this to jsonb as it's going to be more versatile for us
 timestamp TIMESTAMP  NOT NULL,
 query text -- currently missing in our db - will add this to our schema
);

-- One instance for each fingerprint
CREATE TABLE fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  data jsonb, -- also moved to jsonb for future use
  id varchar NOT NULL PRIMARY KEY -- we have an id for fingerprints. This combines and creates a hash of name, feature_name and sha. 
);

CREATE TABLE IF NOT EXISTS repo_fingerprints (
  repo_snapshot_id varchar references repo_snapshots(id),
  fingerprint_id varchar references fingerprints(id),
  PRIMARY KEY (repo_snapshot_id, fingerprint_id)
);

CREATE INDEX ON repo_snapshots (workspace_id);

CREATE INDEX ON fingerprints (name);
CREATE INDEX ON fingerprints (feature_name);
