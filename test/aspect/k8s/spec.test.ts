/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    InMemoryProject,
    InMemoryProjectFile,
} from "@atomist/automation-client";
import * as assert from "power-assert";
import {
    applyK8sSpecsFingerprint,
    createK8sSpecFingerprint,
    createK8sSpecsFingerprints,
    isK8sSpec,
    k8sSpecsFingerprintDisplayName,
    k8sSpecsFingerprintName,
    parseK8sSpecFile,
} from "../../../lib/aspect/k8s/spec";

describe("aspect/k8s/spec", () => {

    describe("isK8sSpec", () => {

        it("should recognize a spec", () => {
            const s = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
            };
            assert(isK8sSpec(s));
        });

        it("should reject a spec without a apiVersion", () => {
            const s = {
                kind: "Service",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
            };
            assert(!isK8sSpec(s));
        });

        it("should reject a spec without a kind", () => {
            const s = {
                apiVersion: "v1",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
            };
            assert(!isK8sSpec(s));
        });

        it("should reject a spec without a name", () => {
            const s = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    namespace: "dinosaur-jr",
                },
            };
            assert(!isK8sSpec(s));
        });

        it("should allow a spec without a namespace", () => {
            const s = {
                apiVersion: "rbac.kubernetes.io/v1",
                kind: "ClusterRole",
                metadata: {
                    name: "freak-scene",
                },
            };
            assert(isK8sSpec(s));
        });

    });

    describe("k8sSpecsFingerprintName", () => {

        it("should create a name", () => {
            const s = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
            };
            const n = k8sSpecsFingerprintName(s);
            const e = "Service::dinosaur-jr::freak-scene";
            assert(n === e);
        });

        it("should create a name without a namespace", () => {
            const s = {
                apiVersion: "rbac.kubernetes.io/v1",
                kind: "ClusterRole",
                metadata: {
                    name: "freak-scene",
                },
            };
            const n = k8sSpecsFingerprintName(s);
            const e = "ClusterRole::freak-scene";
            assert(n === e);
        });

        it("should throw an error if a non-spec is provided", () => {
            const s: any = {
                apiVersion: "v1",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
            };
            assert.throws(() => k8sSpecsFingerprintName(s), /The provided Kubernetes spec is not valid: /);
        });

    });

    describe("k8sSpecsFingerprintDisplayName", () => {

        it("should create a display name", () => {
            const n = "Service::dinosaur-jr::freak-scene";
            const d = k8sSpecsFingerprintDisplayName(n);
            const e = "Service/dinosaur-jr/freak-scene";
            assert(d === e);
        });

        it("should create a display name without a namespace", () => {
            const n = "ClusterRole::freak-scene";
            const d = k8sSpecsFingerprintDisplayName(n);
            const e = "ClusterRole/freak-scene";
            assert(d === e);
        });

    });

    describe("createK8sSpecFingerprint", () => {

        it("should create a valid fingerprint", () => {
            const s = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
                spec: {
                    ports: [
                        {
                            name: "http",
                            port: 8080,
                            targetPort: "http",
                        },
                    ],
                    selector: {
                        "app.kubernetes.io/name": "bug",
                    },
                },
            };
            const f = createK8sSpecFingerprint(s);
            const e = {
                type: "k8s-specs",
                name: "Service::dinosaur-jr::freak-scene",
                abbreviation: "k8sspecs",
                version: "0.0.1",
                data: s,
                sha: "97658d338cf82d5962cc6212e44a4fa0e78c554a7fa12477648e88ef83e3b4b2",
            };
            assert.deepStrictEqual(f, e);
        });

        it("should create same fingerprint regardless of spec property order", () => {
            const s = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: "freak-scene",
                    namespace: "dinosaur-jr",
                },
                spec: {
                    ports: [
                        {
                            name: "http",
                            port: 8080,
                            targetPort: "http",
                        },
                    ],
                    selector: {
                        "app.kubernetes.io/name": "bug",
                    },
                },
            };
            const t = {
                spec: {
                    selector: {
                        "app.kubernetes.io/name": "bug",
                    },
                    ports: [
                        {
                            port: 8080,
                            targetPort: "http",
                            name: "http",
                        },
                    ],
                },
                metadata: {
                    namespace: "dinosaur-jr",
                    name: "freak-scene",
                },
                kind: "Service",
                apiVersion: "v1",
            };
            const f = createK8sSpecFingerprint(s);
            const g = createK8sSpecFingerprint(t);
            assert.deepStrictEqual(g, f);
        });

        it("should not include managed-by label in fingerprint", () => {
            const s = {
                apiVersion: "apps/v1",
                kind: "Deployment",
                metadata: {
                    labels: {
                        "app.kubernetes.io/managed-by": "atomist_k8s-sdm_k8s-internal-integration",
                        "app.kubernetes.io/name": "autumn-sweater",
                        "app.kubernetes.io/part-of": "yo-la-tengo",
                        "atomist.com/workspaceId": "AY014T3NG0",
                    },
                    name: "autumn-sweater",
                    namespace: "yo-la-tengo",
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            "app.kubernetes.io/name": "autumn-sweater",
                            "atomist.com/workspaceId": "AY014T3NG0",
                        },
                    },
                    template: {
                        metadata: {
                            labels: {
                                "app.kubernetes.io/managed-by": "atomist_k8s-sdm_k8s-internal-integration",
                                "app.kubernetes.io/name": "autumn-sweater",
                                "app.kubernetes.io/part-of": "yo-la-tengo",
                                "atomist.com/workspaceId": "AY014T3NG0",
                            },
                            name: "autumn-sweater",
                        },
                        spec: {
                            containers: [
                                {
                                    image: "atomist/k8s-sdm:1.4.0-master.20190808205207",
                                    name: "autumn-sweater",
                                },
                            ],
                        },
                    },
                },
            };
            const f = createK8sSpecFingerprint(s);
            const e = {
                type: "k8s-specs",
                name: "Deployment::yo-la-tengo::autumn-sweater",
                abbreviation: "k8sspecs",
                version: "0.0.1",
                data: {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/name": "autumn-sweater",
                            "app.kubernetes.io/part-of": "yo-la-tengo",
                            "atomist.com/workspaceId": "AY014T3NG0",
                        },
                        name: "autumn-sweater",
                        namespace: "yo-la-tengo",
                    },
                    spec: {
                        replicas: 1,
                        selector: {
                            matchLabels: {
                                "app.kubernetes.io/name": "autumn-sweater",
                                "atomist.com/workspaceId": "AY014T3NG0",
                            },
                        },
                        template: {
                            metadata: {
                                labels: {
                                    "app.kubernetes.io/name": "autumn-sweater",
                                    "app.kubernetes.io/part-of": "yo-la-tengo",
                                    "atomist.com/workspaceId": "AY014T3NG0",
                                },
                                name: "autumn-sweater",
                            },
                            spec: {
                                containers: [
                                    {
                                        image: "atomist/k8s-sdm:1.4.0-master.20190808205207",
                                        name: "autumn-sweater",
                                    },
                                ],
                            },
                        },
                    },
                },
                sha: "9d219c8b9f41f5630b5efc95e7c2eb8a0dc7178c298b797e150e4d6ce3e6fa2e",
            };
            assert.deepStrictEqual(f, e);
        });

        it("should throw an exception when passed an invalid spec", () => {
            const s: any = { sebadoh: "rebound" };
            assert.throws(() => createK8sSpecFingerprint(s), /The provided Kubernetes spec is not valid: /);
        });

    });

    describe("parseK8sSpecFile", () => {

        it("should parse a spec", async () => {
            const f = new InMemoryProjectFile("providence.yaml", `apiVersion: v1
kind: Service
metadata:
  name: providence
  namespace: sonic-youth
`);
            const s = await parseK8sSpecFile(f);
            const e = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: "providence",
                    namespace: "sonic-youth",
                },
            };
            assert.deepStrictEqual(s, e);
        });

        it("should return undefined for a non-spec", async () => {
            const f = new InMemoryProjectFile("providence.json", `{}`);
            const s = await parseK8sSpecFile(f);
            assert(s === undefined);
        });

    });

    describe("createK8sSpecsFingerprints", () => {

        it("should return fingerprints if no specs", async () => {
            const p = InMemoryProject.of();
            const f = await createK8sSpecsFingerprints(p);
            assert.deepStrictEqual(f, []);
        });

        it("should return fingerprints for specs", async () => {
            const p = InMemoryProject.of(
                { path: "README.md", content: "Hello, world.\n" },
                { path: "svc.yml", content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: providence\n  namespace: sonic-youth\n" },
                {
                    path: "dep.json",
                    content: `{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"name":"providence","namespace":"sonic-youth"}}`,
                },
                { path: "sa.json", content: "{}" },
            );
            const f = await createK8sSpecsFingerprints(p);
            const e = [
                {
                    type: "k8s-specs",
                    name: "Service::sonic-youth::providence",
                    abbreviation: "k8sspecs",
                    version: "0.0.1",
                    data: {
                        apiVersion: "v1",
                        kind: "Service",
                        metadata: {
                            name: "providence",
                            namespace: "sonic-youth",
                        },
                    },
                    sha: "efb7bbe1f03bdc744cefbb5d150ef37c8570b159a99d5f89cca6e9ed47f5138b",
                },
                {
                    type: "k8s-specs",
                    name: "Deployment::sonic-youth::providence",
                    abbreviation: "k8sspecs",
                    version: "0.0.1",
                    data: {
                        apiVersion: "apps/v1",
                        kind: "Deployment",
                        metadata: {
                            name: "providence",
                            namespace: "sonic-youth",
                        },
                    },
                    sha: "df9e9f62024d15c7823c6eb688cf3489f3c640f2f9af892880108b385a9fa37d",
                },
            ];
            assert.deepStrictEqual(f, e);
        });

    });

    describe("applyK8sSpecsFingerprint", () => {

        it("should do nothing if there is no matching spec", async () => {
            const p = InMemoryProject.of(
                { path: "README.md", content: "Hello, world.\n" },
                { path: "svc.yml", content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: providence\n  namespace: sonic-youth\n" },
                { path: "sa.json", content: "{}" },
            );
            const fp = {
                type: "k8s-specs",
                name: "Deployment::sonic-youth::providence",
                abbreviation: "k8sspecs",
                version: "0.0.1",
                data: {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        name: "providence",
                        namespace: "sonic-youth",
                    },
                },
                sha: "df9e9f62024d15c7823c6eb688cf3489f3c640f2f9af892880108b385a9fa37d",
            };
            assert(!await applyK8sSpecsFingerprint(p, fp));

        });

        it("should update the matching spec", async () => {
            const p = InMemoryProject.of(
                { path: "README.md", content: "Hello, world.\n" },
                { path: "svc.yml", content: "apiVersion: v1\nkind: Service\nmetadata:\n  name: providence\n  namespace: sonic-youth\n" },
                {
                    path: "dep.json",
                    content: `{"apiVersion":"extensions/v1beta1","kind":"Deployment","metadata":{"name":"providence","namespace":"sonic-youth"}}`,
                },
                { path: "sa.json", content: "{}" },
            );
            const fp = {
                type: "k8s-specs",
                name: "Deployment::sonic-youth::providence",
                abbreviation: "k8sspecs",
                version: "0.0.1",
                data: {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        name: "providence",
                        namespace: "sonic-youth",
                    },
                },
                sha: "df9e9f62024d15c7823c6eb688cf3489f3c640f2f9af892880108b385a9fa37d",
            };
            assert(await applyK8sSpecsFingerprint(p, fp));
            const c = await (await p.getFile("dep.json")).getContent();
            assert(c === `{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"name":"providence","namespace":"sonic-youth"}}`);
        });

    });

});
