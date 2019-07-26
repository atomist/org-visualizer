
\set ON_ERROR_STOP true

-- create the database if needed (in psql):

DROP DATABASE org_viz;
CREATE DATABASE org_viz;

-- Connect to that database (in psql)
\connect org_viz

-- Run this DDL in either psql or pgadmin:

DROP TABLE IF EXISTS repo_fingerprints;

DROP TYPE IF EXISTS severity;

DROP TABLE IF EXISTS fingerprints;

DROP TABLE IF EXISTS repo_snapshots;

DROP TABLE IF EXISTS fingerprint_analytics;

DROP TABLE IF EXISTS ideal_fingerprints;

DROP TABLE IF EXISTS problem_fingerprints;

-- Contains the latest snapshot for the given repository
-- Application code should delete any previously held data for this
-- repository so we only have one snapshot for every repository
CREATE TABLE repo_snapshots (
 id varchar NOT NULL PRIMARY KEY,
 workspace_id varchar NOT NULL,
 provider_id text NOT NULL,
 owner text NOT NULL,
 name text NOT NULL,
 url text NOT NULL,
 branch text,
 path text,
 commit_sha varchar NOT NULL,
 analysis jsonb,
 timestamp TIMESTAMP  NOT NULL,
 query text
);

-- Each fingerprint we've seen
CREATE TABLE fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  data jsonb,
  id varchar NOT NULL PRIMARY KEY
);

-- Join table between repo_snapshots and fingerprints
CREATE TABLE IF NOT EXISTS repo_fingerprints (
  repo_snapshot_id varchar references repo_snapshots(id),
  fingerprint_id varchar references fingerprints(id),
  PRIMARY KEY (repo_snapshot_id, fingerprint_id)
);

-- Usage information about fingerprints
-- This table must be kept up to date by application code
-- whenever a fingerprint is inserted
CREATE TABLE fingerprint_analytics (
  name text NOT NULL,
  feature_name text NOT NULL,
  workspace_id varchar NOT NULL,
  count numeric,
  entropy numeric,
  variants numeric,
  PRIMARY KEY (name, feature_name, workspace_id)
);

-- For each name/feature_name combination, the ideal for the given workspace
CREATE TABLE ideal_fingerprints (
  fingerprint_id varchar references fingerprints(id),
  -- Workspace this ideal applies to
  workspace_id varchar NOT NULL,
  -- Who says this is the ideal?
  authority varchar NOT NULL,
  -- URL relating to the ideal, if available
  url varchar,
  PRIMARY KEY (fingerprint_id, workspace_id)
);

CREATE TYPE severity AS ENUM ('info', 'warn', 'error');

-- Fingerprints with known problems. For example, security risks.
CREATE TABLE problem_fingerprints (
  fingerprint_id varchar references fingerprints(id),
  -- Workspace this problem report applies to.
  workspace_id varchar NOT NULL,
  -- Severity of this problem
  severity severity NOT NULL,
  authority varchar NOT NULL,
  -- Third party identifier if available, such as a CVE identifier
  identifier varchar,
  description text,
  -- URL relating to the problem, if available
  url varchar,
  date_added timestamp NOT NULL,
  PRIMARY KEY (fingerprint_id, workspace_id)
);

CREATE INDEX ON repo_snapshots (workspace_id);

CREATE INDEX ON repo_fingerprints (repo_snapshot_id);
CREATE INDEX ON repo_fingerprints (fingerprint_id);

CREATE INDEX ON fingerprints (name);
CREATE INDEX ON fingerprints (feature_name);

CREATE INDEX ON fingerprint_analytics (workspace_id);
CREATE INDEX ON fingerprint_analytics (feature_name);


