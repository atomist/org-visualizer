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

import * as d3 from "d3";
import {
    BaseType,
    HierarchyNode,
} from "d3";
import {
    PlantedTree,
    SunburstLeaf,
    SunburstTree,
} from "../tree/sunburst";

/**
 * Color palette for d3 to use
 */
const palette = [
    "#56b06f",
    "#3bbaa8",
    "#35848c",
    "#173d6d",
    "#846473",
    "#5F7186",
    "#0d560d",
    "#1f8045",
    "#173d48",
];

// tslint:disable

export function sunburst(someName, dataUrl: string, pWidth, pHeight, perLevelDataElementIds: string[]) {
    const minDiameterInPixels = 100;

    const width = Math.max(pWidth || window.innerWidth, minDiameterInPixels),
        height = Math.max(pHeight || window.innerHeight, minDiameterInPixels),
        maxRadius = (Math.min(width, height) / 2) - 5;
    const viewBoxSide = maxRadius * 2 + 10;

    const formatNumber = d3.format(",d");

    const x = d3.scaleLinear()
        .range([0, 2 * Math.PI])
        .clamp(true);

    const y = d3.scaleSqrt()
        .range([maxRadius * .1, maxRadius]);

    const color = d3.scaleOrdinal(palette);

    const arc = d3.arc()
        .startAngle((d: any) => x(d.x0))
        .endAngle((d: any) => x(d.x1))
        .innerRadius((d: any) => Math.max(0, y(d.y0)))
        .outerRadius((d: any) => Math.max(0, y(d.y1)));

    const middleArcLine = d => {
        const halfPi = Math.PI / 2;
        const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
        const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

        const middleAngle = (angles[1] + angles[0]) / 2;
        const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
        if (invertDirection) {
            angles.reverse();
        }

        const path = d3.path();
        path.arc(0, 0, r, angles[0], angles[1], invertDirection);
        return path.toString();
    };

    const textFits = d => {
        const CHAR_SPACE = 6;

        const deltaAngle = x(d.x1) - x(d.x0);
        const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
        const perimeter = r * deltaAngle;

        return d.data.name.length * CHAR_SPACE < perimeter;
    };

    const dataDiv = d3.select("#dataAboutWhatYouClicked");

    const svg = d3.select("#putSvgHere").append("svg")
        .style("width", viewBoxSide + "px")
        .attr("viewBox", `${-viewBoxSide / 2} ${-viewBoxSide / 2} ${viewBoxSide} ${viewBoxSide}`)
        .on("click", focusOn); // Reset zoom on canvas click

    d3.json(dataUrl).then((d: PlantedTree) => {
        console.log("This is a thing: " + JSON.stringify(d));

        if (!d.tree || d.tree.children.length === 0) {
            alert(`No data at ${dataUrl}`);
            return;
        }

        const root = d3.hierarchy<SunburstTree | SunburstLeaf>(d.tree);
        root.sum(d => (d as SunburstLeaf).size || 0); // sets a "value" property on each node

        const slice = svg.selectAll<BaseType, SunburstTree | SunburstLeaf>("g.slice")
            .data(d3.partition<SunburstTree | SunburstLeaf>()(root).descendants());

        slice.exit().remove();

        const perLevelDataElements = perLevelDataElementIds.map(id => d3.select("#" + id)).filter(a => !!a);

        const newSlice = slice.enter()
            .append("g").attr("class", "slice")
            .on("click", d => {
                d3.event.stopPropagation();
                focusOn(d);
            })
            .on("mouseover", (d: HierarchyNode<SunburstTree | SunburstLeaf>) => {
                populatePerLevelData(perLevelDataElements, d);
            });

        newSlice.append("title")
            .text(d => d.data.name + "\n" + formatNumber(d.value));

        newSlice.append("path")
            .attr("class", "main-arc")
            .style("fill", (d: any) => d.data.color || (color as any)((d.children ? d : d.parent).data.name))
            .attr("d", arc as any);

        newSlice.append("path")
            .attr("class", "hidden-arc")
            .attr("id", (_, i) => `hiddenArc${i}`)
            .attr("d", middleArcLine);

        const text = newSlice.append("text")
            .attr("display", d => textFits(d) ? null : "none");

        // Add white contour
        text.append("textPath")
            .attr("class", "textOutline")
            .attr("startOffset", "50%")
            .attr("xlink:href", (_, i) => `#hiddenArc${i}`)
            .text(d => d.data.name);

        text.append("textPath")
            .attr("startOffset", "50%")
            .attr("xlink:href", (_, i) => `#hiddenArc${i}`)
            .text(d => d.data.name);
    });

    function focusOn(d = { x0: 0, x1: 1, y0: 0, y1: 1 }) {
        // Reset to top-level if no data point specified

        const transition = svg.transition()
            .duration(750)
            .tween("scale", () => {
                const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                    yd = d3.interpolate(y.domain(), [d.y0, 1]);
                return t => {
                    x.domain(xd(t));
                    y.domain(yd(t));
                };
            });

        transition.selectAll("path.main-arc")
            .attrTween("d", d => () => arc(d as any));

        transition.selectAll("path.hidden-arc")
            .attrTween("d", d => () => middleArcLine(d));

        transition.selectAll("text")
            .attrTween("display", d => () => textFits(d) ? null : "none");

        moveStackToFront(d);

        function moveStackToFront(elD) {
            svg.selectAll<BaseType, HierarchyNode<SunburstTree | SunburstLeaf>>(".slice").filter(d => d === elD)
                .each(function (d) {
                    (this as any).parentNode.appendChild(this); // move all parents to the end of the line
                    if (d.parent) {
                        moveStackToFront(d.parent);
                    }
                });
        }
    }
}

function populatePerLevelData(perLevelDataElements: d3.Selection<any, any, any, any>[], d: HierarchyNode<SunburstTree | SunburstLeaf>) {
    console.log("I will now populate some data for " + d.data.name);

    const namesUpTree = [d.data.name];
    for (let place: any = d; place = place.parent; !!place) {
        namesUpTree.push(place.data.name);
    }

    const namesDown = namesUpTree.reverse();
    perLevelDataElements.forEach((e, i) => {
        const value = namesDown[i] || "";
        console.log("Trying to set something to " + value);
        e.html(value);
    });
}

function constructDescription(d) {
    // TODO this is not good
    const workspaceId = "*";
    let descriptionOfWhereYouClicked = `${d.data.name}`;
    for (let place = d; place = place.parent; !!place) {
        descriptionOfWhereYouClicked = place.data.name + "<br/>" + descriptionOfWhereYouClicked;
    }
    if (d.data.size === 1) {
        descriptionOfWhereYouClicked = descriptionOfWhereYouClicked +
            `<br/><a href="${d.data.url}">${d.data.url}</a>`;
    }
    if (!!d.data.sha) {
        // This is a fingerprint with a sha
        const setIdealLink = `<button id="setIdeal"
                    onclick="postSetIdeal('${workspaceId}','${d.data.id}')"
                    >Set as ideal</button><label for="setIdeal" id="setIdealLabel" class="nothingToSay">&nbsp;</label>`;
        const noteProblemLink = `<button id="noteProblem"
                    onclick="postNoteProblem('${workspaceId}','${d.data.id}')"
                    >Note as problem</button><label for="noteProblem" id="noteProblemLabel" class="nothingToSay">&nbsp;</label>`;
        descriptionOfWhereYouClicked = descriptionOfWhereYouClicked +
            "<br/>" + setIdealLink + "<br/>" + noteProblemLink;
    }
    return descriptionOfWhereYouClicked;
}

function postSetIdeal(workspaceId: string, fingerprintId: string) {
    const postUrl = `./api/v1/${workspaceId}/ideal/${fingerprintId}`;
    const labelElement = document.getElementById("setIdealLabel");
    fetch(postUrl, { method: "PUT" }).then(response => {
        if (response.ok) {
            labelElement.textContent = `Ideal set for workspace '${workspaceId}'`;
            labelElement.setAttribute("class", "success");
            labelElement.setAttribute("display", "static");
        } else {
            labelElement.textContent = "Failed to set. consult the server logaments";
            labelElement.setAttribute("class", "error");
        }
    },
        e => {
            labelElement.textContent = "Network error";
            labelElement.setAttribute("class", "error");
        });
}

function postNoteProblem(workspaceId: string, fingerprintId: string) {
    const postUrl = `./api/v1/${workspaceId}/problem/${fingerprintId}`;
    const labelElement = document.getElementById("noteProblemLabel");
    fetch(postUrl, { method: "PUT" }).then(response => {
        if (response.ok) {
            labelElement.textContent = `Problem noted for workspace '${workspaceId}'`;
            labelElement.setAttribute("class", "success");
            labelElement.setAttribute("display", "static");
        } else {
            labelElement.textContent = "Failed to set. consult the server logaments";
            labelElement.setAttribute("class", "error");
        }
    },
        e => {
            labelElement.textContent = "Network error";
            labelElement.setAttribute("class", "error");
        });
}
