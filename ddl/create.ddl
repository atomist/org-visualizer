DROP DATABASE org_viz;
CREATE DATABASE org_viz;
\connect org_viz

DROP TABLE IF EXISTS repo_fingerprints;

DROP TABLE IF EXISTS problem_fingerprints;

DROP TYPE SEVERITY;

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

-- Join table
CREATE TABLE repo_fingerprints ( -- the two above id changes simplify this table
  repo_snapshot_id varchar references repo_snapshots(id),
  fingerprint_id varchar references fingerprints(id),
  PRIMARY KEY (repo_snapshot_id, fingerprint_id)
);

CREATE TYPE severity AS ENUM ('error', 'warn');

CREATE TABLE problem_fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  severity severity NOT NULL,
  message text,
  url text,
  PRIMARY KEY (name, feature_name, sha),
  FOREIGN KEY (name, feature_name, sha) REFERENCES fingerprints (name, feature_name, sha)
);

CREATE INDEX ON repo_snapshots (workspace_id);

CREATE INDEX ON fingerprints (name);
CREATE INDEX ON fingerprints (feature_name);
