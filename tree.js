// tree.js

// Select the SVG by id
const svg = d3.select("#familyTree");

// This group will be zoomed/panned
const g = svg.append("g");

// Ensure the page/body has no margin so svg can truly fill viewport
d3.select("body").style("margin", "0");

// Helper to get current viewport size from the SVG's bounding box
function getSize() {
  const rect = svg.node().getBoundingClientRect();
  return {
    width: Math.max(rect.width, 300),  // fallback minimums
    height: Math.max(rect.height, 200)
  };
}

// Initialize svg CSS (fill viewport) and an initial viewBox
svg
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100vw")
  .style("height", "100vh")
  .style("display", "block"); // remove inline gaps in some browsers

// Load data
Promise.all([
  d3.json("nodes.json"),
  d3.json("links.json")
]).then(([nodes, links]) => {

  addDerivedLinks(nodes, links, true, false);

  // compute size and set viewBox accordingly
  let {width, height} = getSize();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 12)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#555");

  // --- create groups for layering ---
  const linkGroup = g.append("g").attr("class", "links");
  const nodeGroup = g.append("g").attr("class", "nodes");
  const labelGroup = g.append("g").attr("class", "labels");

  // Create the simulation with forces that depend on width/height
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => {
      if (d.type === "spouse") return 60;
      if (d.type === "parent") return 50;
      return 100;
    }))
    .force("charge", d3.forceManyBody().strength(-120))
    .force("collision", d3.forceCollide().radius(d => 3))
    .force("center", d3.forceCenter(width / 3, height / 3));

  // Links
  const link = linkGroup.selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("stroke-width", 2)
    .attr("stroke", d => {
        switch(d.type) {
            case "spouse": return "#e7101055";
            case "parent": return "#38170355";
            case "sibling": return "#20b95355";
            case "cousin": return "blue";
            default: return "#999";
        }})
    .attr("marker-end", d =>
        d.type === "parent" ? "url(#arrow)" : null
    );

  // Nodes
  const node = nodeGroup.selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("r", 15)
    .attr("fill", "#af7049ff")
    .attr("stroke", d => {
      if(d.gender == "male") {return "#090f5aff"}
      else if(d.gender == "female") {return "#7a176dff"}
      return "#000000ff"
    })
    .attr("stroke-width", 2)
    .call(drag(simulation))
    .on("click", (event, d) => showInfo(d, event, node));

  // Labels
  const label = labelGroup.selectAll("text")
    .data(nodes)
    .enter().append("text")
    .text(d => {
      if(d.name == null) {return null} 
      else {return d.name + " " + d.surname}})
    .attr("font-size", "15px")
    .attr("text-anchor", "middle")
    .attr("dy", -20);

  const zoom = d3.zoom()
    .scaleExtent([0.1, 5]) // how far you can zoom out / in
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

  svg.call(zoom);

  simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
  });

  function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  // Resize handler: update viewBox, center force, and gently restart
  function handleResize() {
    const size = getSize();
    width = size.width;
    height = size.height;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // update center force and reheat the sim a bit
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
    simulation.alphaTarget(0.3).restart();

    // optional: adjust link distance scale based on width
    const linkForce = simulation.force("link");
    if (linkForce) {
      linkForce.distance(d => {
        if (d.type === "spouse") return Math.max(30, width * 0.03);
        if (d.type === "parent") return Math.max(60, width * 0.07);
        return Math.max(80, width * 0.12);
      });
    }
  }

  // Add resize listener (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 150);
  });

  // Initial call to ensure correct sizing if the SVG was not sized when script ran
  handleResize();

  // Helper function - turns objects into numbers
  function getNodeId(v) {
    return typeof v === "object" ? v.id : v;
  }

  // Info panel function
  function showInfo(d, event, nodeSelection) {
    // Highlight the selected node
    nodeSelection.attr("stroke", d => {
      if(d.gender == "male") {return "#090f5aff"}
      else if(d.gender == "female") {return "#7a176dff"}
      return "#000000ff"
    })
    .attr("stroke-width", 2);
    d3.select(event.currentTarget)
        .attr("stroke", "orange")
        .attr("stroke-width", 4);

    // Update panel
    d3.select("#info-name").text(d.name ? d.name + " " + d.surname : "");
    d3.select("#info-birth").text(d.dateOfBirth ? 
      "Data urodzenia: " + 
      (d.dateOfBirth[0] ? d.dateOfBirth[0] + "." : "") + 
      (d.dateOfBirth[1] ? d.dateOfBirth[1] + "." : "") + 
      d.dateOfBirth[2] : "");
    d3.select("#info-death").text(d.dateOfDeath ? 
      "Data śmierci: " + 
      (d.dateOfDeath[0] ? d.dateOfDeath[0] + "." : "") + 
      (d.dateOfDeath[1] ? d.dateOfDeath[1] + "." : "") + 
      d.dateOfDeath[2] : "");

    // Parents
    const parentLinks = links.filter(l => l.type === "parent" && getNodeId(l.target) === d.id);
    const parentNames = parentLinks.map(l => nodes.find(n => n.id === getNodeId(l.source)).name);
    d3.select("#info-parents").text(parentNames.length ? "Rodzice: " + "\n" + parentNames.join(", ") : "");

    // Spouse
    const spouseLinks = links.filter(l => l.type === "spouse" && (getNodeId(l.source) === d.id || getNodeId(l.target) === d.id));
    const spouseNames = spouseLinks.map(l => {
        const spouseId = (getNodeId(l.source) === d.id) ? getNodeId(l.target) : getNodeId(l.source);
        return nodes.find(n => n.id === spouseId).name;
    });
    d3.select("#info-spouse").text(spouseNames.length ? (d.gender === "female" ? "Mąż: " : "Żona: ") + "\n" + spouseNames.join(", ") : "");

    // Siblings
    // Either derived from parents or already in links
    const siblingLinks = links.filter(l => l.type === "sibling" && (getNodeId(l.source) === d.id || getNodeId(l.target) === d.id));
    const siblingNames = siblingLinks.map(l => {
        const sibId = (getNodeId(l.source) === d.id) ? getNodeId(l.target) : getNodeId(l.source);
        return nodes.find(n => n.id === sibId).name;
    });
    d3.select("#info-siblings").text(siblingNames.length ? "Rodzeństwo: " + "\n" + siblingNames.join(", ") : "");

    // Children
    const childLinks = links.filter(l => l.type === "parent" && getNodeId(l.source) === d.id);
    const childNames = childLinks.map(l => nodes.find(n => n.id === getNodeId(l.target)).name);
    d3.select("#info-children").text(childNames.length ? "Dzieci: " + "\n" + childNames.join(", ") : "");

  }

  // Optional: generate sibling and cousin links automatically
  function addDerivedLinks(nodes, links, forSiblings, forCousins) {
    // After loading nodes and links
    nodes.forEach(node => {
      // Find all links where this node is the target and type is 'parent'
      const parentLinks = links.filter(l => l.type === "parent" && l.target === node.id);
      // Set a 'parents' property dynamically
      node.parents = parentLinks.map(l => l.source);
    });

    if(forSiblings) {
      // Sibling links
      nodes.forEach(person => {
          if (person.parents) {
              person.parents.forEach(parentId => {
                  const siblings = nodes.filter(n => n.parents?.includes(parentId) && n.id !== person.id);
                  siblings.forEach(sib => {
                      // prevent duplicate sibling links
                      if (!links.find(l => (l.source === person.id && l.target === sib.id) || (l.source === sib.id && l.target === person.id))) {
                          links.push({source: person.id, target: sib.id, type: "sibling"});
                      }
                  });
              });
          }
      });
    }

    if(forCousins) {
      // Cousin links
      nodes.forEach(person => {
          const parents = person.parents?.map(pid => nodes.find(n => n.id === pid));
          parents?.forEach(parent => {
              const unclesAunts = parent.parents?.flatMap(grandparentId =>
                  nodes.filter(n => n.parents?.includes(grandparentId) && n.id !== parent.id)
              );
              unclesAunts?.forEach(ua => {
                  const cousins = nodes.filter(n => n.parents?.includes(ua.id));
                  cousins.forEach(c => {
                      if (!links.find(l => (l.source === person.id && l.target === c.id) || (l.source === c.id && l.target === person.id))) {
                          links.push({source: person.id, target: c.id, type: "cousin"});
                      }
                  });
              });
          });
      });
    }
  }

}).catch(err => {
  console.error("Failed to load data or initialize graph:", err);
});

