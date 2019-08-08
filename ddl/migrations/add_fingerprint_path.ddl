
alter table repo_fingerprints add column path varchar;

update repo_fingerprints set path = '';

alter table repo_fingerprints drop constraint repo_fingerprints_pkey;

alter table repo_fingerprints ADD PRIMARY KEY (repo_snapshot_id, fingerprint_id, path);