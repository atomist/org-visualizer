DROP DATABASE org_viz;
CREATE DATABASE org_viz;
\connect org_viz

DROP TABLE IF EXISTS repo_fingerprints;

DROP TABLE IF EXISTS fingerprints;

DROP TABLE IF EXISTS repo_snapshots;

CREATE TABLE repo_snapshots (
 id serial NOT NULL PRIMARY KEY,
 workspace_id varchar NOT NULL,
 provider_id text NOT NULL,
 owner text NOT NULL,
 name text NOT NULL,
 url text NOT NULL,
 branch text,
 path text,
 commit_sha varchar NOT NULL,
 analysis json,
 timestamp TIMESTAMP  NOT NULL
);

-- One instance for each fingerprint
CREATE TABLE fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  data json,
  PRIMARY KEY (name, feature_name, sha)
);

-- Join table
CREATE TABLE repo_fingerprints (
  repo_snapshot_id int references repo_snapshots(id),
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  PRIMARY KEY (repo_snapshot_id, name, feature_name, sha),
  FOREIGN KEY (name, feature_name, sha) REFERENCES fingerprints (name, feature_name, sha)
);

-- Ideal fingerprints
CREATE TABLE ideal_fingerprints (
  name text NOT NULL,
  feature_name text NOT NULL,
  sha varchar NOT NULL,
  PRIMARY KEY (name, feature_name),
  FOREIGN KEY (name, feature_name, sha) REFERENCES fingerprints (name, feature_name, sha)
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

