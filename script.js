// Global variables
let currentData = [];
let config = {
  type: "bar",
  xCol: null,
  yCol: null,
  zCol: null,
  colorCol: null,
  sizeCol: null,
  showLabels: true,
  showValues: true,
};

let isVRMode = false;
const minZoom = 0.5; // Allow zooming much closer
const maxZoom = 200; // Increased max zoom to 200
const defaultZoom = (minZoom + maxZoom) / 2; // Midpoint for balanced zoom
let currentZoom = defaultZoom;
let lastSliderZoom = defaultZoom;

// Dragging variables
let isPanning = false;
let isRotating = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraRig = null;
let lastPinchDistance = null; // For pinch-to-zoom tracking

// Rotation variables
let graphRotation = { x: 0, y: 0, z: 0 };
let rotationSpeed = 1.5;

const colors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#FF8A65",
  "#A8E6CF",
];

// Add zoom indicator
const zoomIndicator = document.createElement("div");
zoomIndicator.style.position = "absolute";
zoomIndicator.style.bottom = "20px";
zoomIndicator.style.left = "20px";
zoomIndicator.style.background = "rgba(0, 0, 0, 0.7)";
zoomIndicator.style.color = "white";
zoomIndicator.style.padding = "8px 12px";
zoomIndicator.style.borderRadius = "20px";
zoomIndicator.style.fontSize = "12px";
zoomIndicator.style.display = "none";
document.body.appendChild(zoomIndicator);

// Initialize
document
  .getElementById("csvInput")
  .addEventListener("change", handleFileLoad);
document.addEventListener("DOMContentLoaded", function () {
  cameraRig = document.getElementById("cameraRig");

  // Add mouse event listeners for panning
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Add touch event listeners for mobile
  document.addEventListener("touchstart", handleTouchStart);
  document.addEventListener("touchmove", handleTouchMove);
  document.addEventListener("touchend", handleTouchEnd);

  // Draw XZ floor grid
  createXZFloorGrid();

  // Grid/Axis visibility toggles
  document.getElementById('showGridLines').addEventListener('change', function() {
    const grid = document.getElementById('floorGrid');
    grid.setAttribute('visible', this.checked);
  });
  document.getElementById('showAxisLines').addEventListener('change', function() {
    // The three axis cylinders are the first three children of axesContainer
    const axes = document.getElementById('axesContainer');
    // X, Y, Z axis cylinders
    const xAxis = axes.children[0];
    const yAxis = axes.children[2];
    const zAxis = axes.children[4];
    xAxis.setAttribute('visible', this.checked);
    yAxis.setAttribute('visible', this.checked);
    zAxis.setAttribute('visible', this.checked);
  });
  // Set initial visibility (in case)
  document.getElementById('floorGrid').setAttribute('visible', true);
  const axes = document.getElementById('axesContainer');
  axes.children[0].setAttribute('visible', true);
  axes.children[2].setAttribute('visible', true);
  axes.children[4].setAttribute('visible', true);

  // Live toggle for Show Labels and Show Values
  document.getElementById('showLabels').addEventListener('change', function() {
    document.querySelectorAll('#labelsContainer [data-label-type="label"]').forEach(el => {
      el.setAttribute('visible', this.checked);
    });
  });
  document.getElementById('showValues').addEventListener('change', function() {
    document.querySelectorAll('#labelsContainer [data-label-type="value"]').forEach(el => {
      el.setAttribute('visible', this.checked);
    });
  });

  updateModeButtons(); // Ensure mode icons are correct on load

  // Hamburger menu logic
  const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
  const floatingMenu = document.getElementById('floatingViewMenu');
  function setMenuOpen(open) {
    if (open) {
      floatingMenu.style.display = 'flex';
      hamburgerBtn.innerHTML = '&times;';
      hamburgerBtn.setAttribute('aria-label', 'Close menu');
    } else {
      floatingMenu.style.display = 'none';
      hamburgerBtn.innerHTML = '&#9776;';
      hamburgerBtn.setAttribute('aria-label', 'Open menu');
    }
  }
  hamburgerBtn.addEventListener('click', function() {
    setMenuOpen(floatingMenu.style.display === 'none' || !floatingMenu.style.display);
  });
  // Optional: close menu when clicking outside
  document.addEventListener('mousedown', function(e) {
    if (floatingMenu.style.display === 'flex' && !floatingMenu.contains(e.target) && e.target !== hamburgerBtn) {
      setMenuOpen(false);
    }
  });
  setMenuOpen(false); // Ensure menu is closed on load

  // Font size sliders for labels and values
  const labelFontSizeSlider = document.getElementById('labelFontSizeSlider');
  const valueFontSizeSlider = document.getElementById('valueFontSizeSlider');
  const labelFontSizeValue = document.getElementById('labelFontSizeValue');
  const valueFontSizeValue = document.getElementById('valueFontSizeValue');

  function updateLabelFontSize() {
    const size = labelFontSizeSlider.value;
    labelFontSizeValue.textContent = size + 'px';
    document.querySelectorAll('#labelsContainer [data-label-type="label"]').forEach(el => {
      el.setAttribute('scale', `${size/18} ${size/18} ${size/18}`);
    });
  }
  function updateValueFontSize() {
    const size = valueFontSizeSlider.value;
    valueFontSizeValue.textContent = size + 'px';
    document.querySelectorAll('#labelsContainer [data-label-type="value"]').forEach(el => {
      el.setAttribute('scale', `${size/16} ${size/16} ${size/16}`);
    });
  }
  labelFontSizeSlider.addEventListener('input', updateLabelFontSize);
  valueFontSizeSlider.addEventListener('input', updateValueFontSize);

  // Show function input group if chartType is 'function' on load
  const chartTypeSelect = document.getElementById('chartType');
  const functionInputGroup = document.getElementById('functionInputGroup');
  const equationDropdownGroup = document.getElementById('equationDropdownGroup');
  if (chartTypeSelect.value === 'function') {
    functionInputGroup.style.display = '';
    if (equationDropdownGroup) equationDropdownGroup.style.display = '';
  }

  // Prevent background scroll when scrolling inside the sidebar
  const sidebar = document.querySelector('.control-panel');
  sidebar.addEventListener('wheel', function(e) {
    e.stopPropagation();
  }, { passive: false });
  sidebar.addEventListener('touchmove', function(e) {
    e.stopPropagation();
  }, { passive: false });

  const zoomSlider = document.getElementById("zoomSlider");
  if (zoomSlider) {
    // Set slider to the inverted midpoint (centered)
    zoomSlider.value = maxZoom - (defaultZoom - minZoom);
    zoomSlider.min = minZoom;
    zoomSlider.max = maxZoom;
    zoomSlider.step = 0.5;
    lastSliderZoom = defaultZoom;
    zoomSlider.addEventListener("input", function () {
      // Invert the slider value for reversed direction
      const newZoom = maxZoom - (parseFloat(this.value) - minZoom);
      const cameraRig = document.getElementById("cameraRig");
      const camera = document.getElementById("camera");
      const pos = cameraRig.getAttribute("position");
      const worldDirection = new THREE.Vector3();
      camera.object3D.getWorldDirection(worldDirection);
      worldDirection.normalize();
      // Move by the difference in zoom
      const delta = newZoom - lastSliderZoom;
      cameraRig.setAttribute(
        "position",
        `${pos.x + worldDirection.x * delta} ${pos.y + worldDirection.y * delta} ${pos.z + worldDirection.z * delta}`
      );
      currentZoom = newZoom;
      lastSliderZoom = newZoom;
      updateZoomIndicator();
    });
  }

  // Real-time update for xLimit and yLimit
  const xLimitInput = document.getElementById('xLimit');
  const yLimitInput = document.getElementById('yLimit');
  if (xLimitInput) {
    xLimitInput.addEventListener('input', function() {
      generateChart();
    });
  }
  if (yLimitInput) {
    yLimitInput.addEventListener('input', function() {
      generateChart();
    });
  }

  // Hide file input for function plot
  const fileInputContainer = document.getElementById('fileInputContainer');
  function updateFileInputVisibility() {
    if (chartTypeSelect.value === 'function') {
      fileInputContainer.style.display = 'none';
    } else {
      fileInputContainer.style.display = '';
    }
  }
  chartTypeSelect.addEventListener('change', updateFileInputVisibility);
  updateFileInputVisibility();

  // Gyro control: default OFF
  const cameraEl = document.getElementById("camera");
  cameraEl.removeAttribute("look-controls");
  // If look-controls component exists, pause it
  if (cameraEl.components && cameraEl.components['look-controls']) {
    cameraEl.components['look-controls'].pause();
  }
  gyroEnabled = false;
  const gyroBtn = document.getElementById('gyroToggleBtn');
  if (gyroBtn) gyroBtn.classList.remove('active');
});

// Mouse wheel zoom with smoother control
document.addEventListener(
  "wheel",
  function (event) {
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
    event.preventDefault();
  },
  { passive: false }
);

// Add keyboard zoom controls
document.addEventListener("keydown", function (event) {
  if (event.key === "=" || event.key === "+") {
    zoomIn();
  } else if (event.key === "-" || event.key === "_") {
    zoomOut();
  }
});

function handleFileLoad(event) {
  const file = event.target.files[0];
  if (!file) return;

  showLoading(true);

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      currentData = results.data.filter(
        (row) => row && Object.keys(row).length > 0
      );
      updateColumns();
      updateStats();
      showLoading(false);
      // Show unload button when file is loaded
      document.getElementById("unloadButton").style.display = "flex";

      // Auto-generate if we have data
      if (currentData.length > 0) {
        setTimeout(generateChart, 300);
      }
    },
    error: function (error) {
      showError("Failed to parse CSV: " + error.message);
      showLoading(false);
    },
  });
}

function updateColumns() {
  const columns = Object.keys(currentData[0]);
  const numericColumns = columns.filter(
    (col) =>
      typeof currentData[0][col] === "number" ||
      !isNaN(parseFloat(currentData[0][col]))
  );

  updateSelect("xColumn", columns, numericColumns[0] || columns[0]);
  updateSelect(
    "yColumn",
    columns,
    numericColumns[1] || numericColumns[0] || columns[1]
  );
  updateSelect("zColumn", ["None", ...numericColumns]);
  updateSelect("sizeColumn", ["None", ...numericColumns]);
  if (document.getElementById("colorColumn")) {
    updateSelect("colorColumn", ["None", ...columns]);
  }
}

function updateSelect(id, options, defaultValue = null) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = "";

  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    if (option === defaultValue) opt.selected = true;
    select.appendChild(opt);
  });
}

function generateChart() {
  config.type = document.getElementById("chartType").value;
  config.xCol = document.getElementById("xColumn").value;
  config.yCol = document.getElementById("yColumn").value;
  config.zCol =
    document.getElementById("zColumn").value === "None"
      ? null
      : document.getElementById("zColumn").value;
  config.sizeCol =
    document.getElementById("sizeColumn").value === "None"
      ? null
      : document.getElementById("sizeColumn").value;
  const colorColumnEl = document.getElementById("colorColumn");
  config.colorCol = colorColumnEl && colorColumnEl.value !== "None"
    ? colorColumnEl.value
    : null;
  config.showLabels = document.getElementById("showLabels").checked;
  config.showValues = document.getElementById("showValues").checked;

  // Only require data for non-function types
  if (
    config.type !== "function" &&
    (!currentData.length || !config.xCol || !config.yCol)
  ) {
    showError("Please select data and required columns");
    return;
  }

  if (config.type === "function") {
    showLoading(true);
    clearChart();
    updateAxisLabels();
    updateTitle();
    setTimeout(() => {
      try {
        createFunctionPlot();
        showLoading(false);
      } catch (error) {
        showError("Error creating function plot: " + error.message);
        showLoading(false);
      }
    }, 100);
    return;
  }

  showLoading(true);
  clearChart();
  updateAxisLabels();
  updateTitle();

  // Limit data for performance
  const limitedData = currentData.slice(0, 40);

  setTimeout(() => {
    try {
      switch (config.type) {
        case "bar":
          createBarChart(limitedData);
          break;
        case "scatter":
          createScatterChart(limitedData);
          break;
        case "line":
          createLineChart(limitedData);
          break;
        case "pie":
          createPieChart(limitedData);
          break;
        case "surface":
          createSurfaceChart(limitedData);
          break;
        case "network":
          createNetworkChart(limitedData);
          break;
        case "heatmap":
          createHeatmapChart(limitedData);
          break;
      }

      if (config.colorCol) {
        createLegend(limitedData);
      }

      showLoading(false);
    } catch (error) {
      showError("Error creating chart: " + error.message);
      showLoading(false);
    }
  }, 100);
}

function createBarChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");
  const maxValue = Math.max(
    ...data.map((d) => parseFloat(d[config.yCol]) || 0)
  );
  const colorGroups = config.colorCol
    ? [...new Set(data.map((d) => d[config.colorCol]))]
    : null;

  data.forEach((row, index) => {
    const xValue = row[config.xCol];
    const yValue = parseFloat(row[config.yCol]) || 0;
    const height = Math.max((yValue / maxValue) * 3, 0.1);

    const x = ((index % 8) - 4) * 1.2;
    const z = Math.floor(index / 8) * -1.2;

    // Create bar
    const bar = document.createElement("a-box");
    bar.setAttribute("position", `${x} ${height / 2} ${z}`);
    bar.setAttribute("width", "0.8");
    bar.setAttribute("height", height);
    bar.setAttribute("depth", "0.8");

    const color = getColor(row, colorGroups, index);
    bar.setAttribute(
      "material",
      `color: ${color}; metalness: 0.3; roughness: 0.7`
    );

    // Hover effects
    bar.setAttribute(
      "animation__mouseenter",
      "property: scale; to: 1.1 1.1 1.1; startEvents: mouseenter; dur: 200"
    );
    bar.setAttribute(
      "animation__mouseleave",
      "property: scale; to: 1 1 1; startEvents: mouseleave; dur: 200"
    );

    container.appendChild(bar);

    // Add labels
    if (config.showLabels && xValue) {
      const label = document.createElement("a-entity");
      label.setAttribute(
        "text",
        `value: ${String(xValue).substring(
          0,
          8
        )}; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      label.setAttribute("position", `${x} -0.3 ${z}`);
      label.setAttribute("scale", "0.6 0.6 0.6");
      label.setAttribute('data-label-type', 'label');
      labelsContainer.appendChild(label);
    }

    // Add values
    if (config.showValues) {
      const valueLabel = document.createElement("a-entity");
      valueLabel.setAttribute(
        "text",
        `value: ${yValue.toFixed(
          1
        )}; color: #ffff00; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      valueLabel.setAttribute("position", `${x} ${height + 0.2} ${z}`);
      valueLabel.setAttribute("scale", "0.5 0.5 0.5");
      valueLabel.setAttribute('data-label-type', 'value');
      labelsContainer.appendChild(valueLabel);
    }
  });
}

function createScatterChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");
  const colorGroups = config.colorCol
    ? [...new Set(data.map((d) => d[config.colorCol]))]
    : null;

  // Get value ranges
  const xValues = data.map((d) => parseFloat(d[config.xCol]) || 0);
  const yValues = data.map((d) => parseFloat(d[config.yCol]) || 0);
  const xRange = [Math.min(...xValues), Math.max(...xValues)];
  const yRange = [Math.min(...yValues), Math.max(...yValues)];

  data.forEach((row, index) => {
    const xVal = parseFloat(row[config.xCol]) || 0;
    const yVal = parseFloat(row[config.yCol]) || 0;
    const x = normalize(xVal, xRange) * 8 - 4;
    const y = normalize(yVal, yRange) * 4;
    const z = (Math.random() - 0.5) * 3;

    const sphere = document.createElement("a-sphere");
    sphere.setAttribute("position", `${x} ${y} ${z}`);
    sphere.setAttribute("radius", "0.15");

    const color = getColor(row, colorGroups, index);
    sphere.setAttribute(
      "material",
      `color: ${color}; metalness: 0.2; roughness: 0.8`
    );

    sphere.setAttribute(
      "animation__mouseenter",
      "property: scale; to: 1.8 1.8 1.8; startEvents: mouseenter; dur: 200"
    );
    sphere.setAttribute(
      "animation__mouseleave",
      "property: scale; to: 1 1 1; startEvents: mouseleave; dur: 200"
    );

    container.appendChild(sphere);

    // Add value labels on hover
    if (config.showValues) {
      const valueLabel = document.createElement("a-entity");
      valueLabel.setAttribute(
        "text",
        `value: (${xVal.toFixed(1)}, ${yVal.toFixed(
          1
        )}); color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      valueLabel.setAttribute("position", `${x} ${y + 0.3} ${z}`);
      valueLabel.setAttribute("scale", "0.4 0.4 0.4");
      valueLabel.setAttribute("visible", "false");
      valueLabel.setAttribute('data-label-type', 'value');

      sphere.setAttribute(
        "animation__showlabel",
        "property: visible; to: true; startEvents: mouseenter"
      );
      sphere.setAttribute(
        "animation__hidelabel",
        "property: visible; to: false; startEvents: mouseleave"
      );

      labelsContainer.appendChild(valueLabel);
    }
  });
}

function createLineChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");
  // Detect if x-values are numeric
  const isXNumeric = data.every(d => !isNaN(parseFloat(d[config.xCol])) && isFinite(d[config.xCol]));
  let xPositions = [];
  let xLabels = [];
  let sortedData;

  if (isXNumeric) {
    sortedData = [...data].sort((a, b) => (parseFloat(a[config.xCol]) || 0) - (parseFloat(b[config.xCol]) || 0));
    const xValues = sortedData.map(d => parseFloat(d[config.xCol]) || 0);
    const xRange = [Math.min(...xValues), Math.max(...xValues)];
    xPositions = xValues.map(xVal => normalize(xVal, xRange) * 8 - 4);
    xLabels = sortedData.map(d => d[config.xCol]);
  } else {
    // Categorical or date x-values: use index for spacing
    sortedData = [...data];
    xPositions = sortedData.map((_, i) => (i / (sortedData.length - 1 || 1)) * 8 - 4);
    xLabels = sortedData.map(d => d[config.xCol]);
  }

  const yValues = sortedData.map(d => parseFloat(d[config.yCol]) || 0);
  const yRange = [Math.min(...yValues), Math.max(...yValues)];

  // Store all point positions for line drawing
  const points = [];

  for (let i = 0; i < sortedData.length; i++) {
    const yVal = parseFloat(sortedData[i][config.yCol]) || 0;
    const x = xPositions[i];
    const y = normalize(yVal, yRange) * 4;
    const z = 0;
    points.push({ x, y, z });

    // Create point
    const point = document.createElement("a-sphere");
    point.setAttribute("position", `${x} ${y} ${z}`);
    point.setAttribute("radius", "0.08");
    point.setAttribute("material", "color: #3498db; metalness: 0.3");
    point.setAttribute(
      "animation__mouseenter",
      "property: scale; to: 2 2 2; startEvents: mouseenter; dur: 200"
    );
    point.setAttribute(
      "animation__mouseleave",
      "property: scale; to: 1 1 1; startEvents: mouseleave; dur: 200"
    );
    container.appendChild(point);

    // Add value labels
    if (config.showValues) {
      const valueLabel = document.createElement("a-entity");
      valueLabel.setAttribute(
        "text",
        `value: ${yVal.toFixed(1)}; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      valueLabel.setAttribute("position", `${x} ${y + 0.2} 0.1`);
      valueLabel.setAttribute("scale", "0.4 0.4 0.4");
      valueLabel.setAttribute('data-label-type', 'value');
      labelsContainer.appendChild(valueLabel);
    }

    // Add x-axis labels for categorical/date x-values
    if (!isXNumeric && config.showLabels) {
      const xLabel = document.createElement("a-entity");
      xLabel.setAttribute(
        "text",
        `value: ${xLabels[i]}; color: #ffffff; align: center; baseline: center; wrapCount: 10; shader: msdf`
      );
      xLabel.setAttribute("position", `${x} -0.3 0`);
      xLabel.setAttribute("scale", "0.3 0.3 0.3");
      xLabel.setAttribute('data-label-type', 'label');
      labelsContainer.appendChild(xLabel);
    }
  }

  // Draw lines between consecutive points using aframe-line-component
  const distanceThreshold = 1.5; // Only connect points that are close
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    if (dist < distanceThreshold) {
      const line = document.createElement("a-entity");
      line.setAttribute("line", {
        start: `${p1.x} ${p1.y} ${p1.z}`,
        end: `${p2.x} ${p2.y} ${p2.z}`,
        color: "#2c3e50",
        opacity: 0.85
      });
      container.appendChild(line);
    }
  }
}

function createPieChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");

  // Group data by X column and sum Y values
  const groupedData = data.reduce((acc, row) => {
    const key = row[config.xCol];
    const value = parseFloat(row[config.yCol]) || 0;
    acc[key] = (acc[key] || 0) + value;
    return acc;
  }, {});

  const total = Object.values(groupedData).reduce(
    (sum, val) => sum + val,
    0
  );
  const entries = Object.entries(groupedData);
  const radius = 3;
  const height = 0.5;
  let currentAngle = 0;

  entries.forEach(([label, value], index) => {
    const percentage = value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const midAngle = (startAngle + endAngle) / 2;

    // Create pie slice
    const slice = document.createElement("a-entity");
    slice.setAttribute("position", "0 0 0");

    // Create the pie slice using a custom geometry
    const geometry = document.createElement("a-cylinder");
    geometry.setAttribute("height", height);
    geometry.setAttribute("radius", radius);
    geometry.setAttribute("theta-start", startAngle);
    geometry.setAttribute("theta-length", angle);
    geometry.setAttribute(
      "material",
      `color: ${
        colors[index % colors.length]
      }; metalness: 0.3; roughness: 0.7`
    );

    // Add top and bottom faces
    const topFace = document.createElement("a-circle");
    topFace.setAttribute("radius", radius);
    topFace.setAttribute("theta-start", startAngle);
    topFace.setAttribute("theta-length", angle);
    topFace.setAttribute(
      "material",
      `color: ${
        colors[index % colors.length]
      }; metalness: 0.3; roughness: 0.7`
    );
    topFace.setAttribute("position", `0 ${height / 2} 0`);
    topFace.setAttribute("rotation", "90 0 0");

    const bottomFace = document.createElement("a-circle");
    bottomFace.setAttribute("radius", radius);
    bottomFace.setAttribute("theta-start", startAngle);
    bottomFace.setAttribute("theta-length", angle);
    bottomFace.setAttribute(
      "material",
      `color: ${
        colors[index % colors.length]
      }; metalness: 0.3; roughness: 0.7`
    );
    bottomFace.setAttribute("position", `0 ${-height / 2} 0`);
    bottomFace.setAttribute("rotation", "-90 0 0");

    slice.appendChild(geometry);
    slice.appendChild(topFace);
    slice.appendChild(bottomFace);

    // Add hover effects
    slice.setAttribute(
      "animation__mouseenter",
      "property: scale; to: 1.1 1.1 1.1; startEvents: mouseenter; dur: 200"
    );
    slice.setAttribute(
      "animation__mouseleave",
      "property: scale; to: 1 1 1; startEvents: mouseleave; dur: 200"
    );

    container.appendChild(slice);

    // Add labels
    if (config.showLabels) {
      const labelRadius = radius * 1.2;
      const labelAngle = (midAngle * Math.PI) / 180;
      const labelX = Math.cos(labelAngle) * labelRadius;
      const labelZ = Math.sin(labelAngle) * labelRadius;

      // Create label container
      const labelContainer = document.createElement("a-entity");
      labelContainer.setAttribute("position", `${labelX} 0 ${labelZ}`);
      labelContainer.setAttribute("rotation", `0 ${-midAngle} 0`);

      // Add label text
      const text = document.createElement("a-entity");
      text.setAttribute(
        "text",
        `value: ${label}\n${(percentage * 100).toFixed(
          1
        )}%; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      text.setAttribute("position", "0 0 0");
      text.setAttribute('data-label-type', 'label');
      labelContainer.appendChild(text);
      labelsContainer.appendChild(labelContainer);
    }

    // Add value label on top
    if (config.showValues) {
      const valueRadius = radius * 0.7;
      const valueAngle = (midAngle * Math.PI) / 180;
      const valueX = Math.cos(valueAngle) * valueRadius;
      const valueZ = Math.sin(valueAngle) * valueRadius;

      const valueText = document.createElement("a-entity");
      valueText.setAttribute(
        "text",
        `value: ${value.toFixed(
          1
        )}; color: #ffff00; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      valueText.setAttribute(
        "position",
        `${valueX} ${height / 2 + 0.1} ${valueZ}`
      );
      valueText.setAttribute("rotation", `0 ${-midAngle} 0`);
      valueText.setAttribute("scale", "0.5 0.5 0.5");
      valueText.setAttribute('data-label-type', 'value');
      labelsContainer.appendChild(valueText);
    }

    currentAngle = endAngle;
  });

  // Add center point
  const center = document.createElement("a-sphere");
  center.setAttribute("position", "0 0 0");
  center.setAttribute("radius", "0.1");
  center.setAttribute("material", "color: #ffffff; metalness: 0.5");
  container.appendChild(center);
}

function createSurfaceChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");

  // Create a grid of points
  const gridSize = Math.ceil(Math.sqrt(data.length));
  const points = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const index = i * gridSize + j;
      if (index < data.length) {
        const x = (i - gridSize / 2) * 0.5;
        const z = (j - gridSize / 2) * 0.5;
        const y = parseFloat(data[index][config.yCol]) || 0;
        points.push({ x, y, z });
      }
    }
  }

  // Create surface mesh
  points.forEach((point, index) => {
    const sphere = document.createElement("a-sphere");
    sphere.setAttribute("position", `${point.x} ${point.y} ${point.z}`);
    sphere.setAttribute("radius", "0.1");
    sphere.setAttribute(
      "material",
      `color: ${colors[index % colors.length]}; metalness: 0.3`
    );

    // Add connecting lines
    if (index % gridSize < gridSize - 1 && index + 1 < points.length) {
      const line = createLine(point, points[index + 1]);
      container.appendChild(line);
    }
    if (index + gridSize < points.length) {
      const line = createLine(point, points[index + gridSize]);
      container.appendChild(line);
    }

    container.appendChild(sphere);
  });
}

function createNetworkChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");

  // Create nodes
  const nodes = new Set();
  data.forEach((row) => {
    nodes.add(row[config.xCol]);
    if (config.zCol) nodes.add(row[config.zCol]);
  });

  const nodePositions = new Map();
  const radius = 5;
  let index = 0;

  nodes.forEach((node) => {
    const angle = (index * 2 * Math.PI) / nodes.size;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    nodePositions.set(node, { x, y: 0, z });

    // Create node sphere
    const sphere = document.createElement("a-sphere");
    sphere.setAttribute("position", `${x} 0 ${z}`);
    sphere.setAttribute("radius", "0.2");
    sphere.setAttribute(
      "material",
      `color: ${colors[index % colors.length]}; metalness: 0.3`
    );
    container.appendChild(sphere);

    // Add label
    if (config.showLabels) {
      const text = document.createElement("a-entity");
      text.setAttribute(
        "text",
        `value: ${String(
          node
        )}; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
      );
      text.setAttribute("position", `${x} 0.3 ${z}`);
      text.setAttribute("scale", "0.6 0.6 0.6");
      text.setAttribute('data-label-type', 'label');
      labelsContainer.appendChild(text);
    }

    index++;
  });

  // Create connections
  data.forEach((row) => {
    const from = nodePositions.get(row[config.xCol]);
    const to = nodePositions.get(row[config.zCol]);

    if (from && to) {
      const line = createLine(from, to);
      container.appendChild(line);
    }
  });
}

function createHeatmapChart(data) {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");

  // Create a grid of cells
  const gridSize = Math.ceil(Math.sqrt(data.length));
  const maxValue = Math.max(
    ...data.map((d) => parseFloat(d[config.yCol]) || 0)
  );

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const index = i * gridSize + j;
      if (index < data.length) {
        const x = (i - gridSize / 2) * 0.5;
        const z = (j - gridSize / 2) * 0.5;
        const value = parseFloat(data[index][config.yCol]) || 0;
        const intensity = value / maxValue;

        // Create heat cell
        const cell = document.createElement("a-box");
        cell.setAttribute("position", `${x} 0 ${z}`);
        cell.setAttribute("width", "0.4");
        cell.setAttribute("height", "0.1");
        cell.setAttribute("depth", "0.4");
        cell.setAttribute(
          "material",
          `color: ${getHeatColor(intensity)}; metalness: 0.3`
        );
        container.appendChild(cell);

        // Add value label
        if (config.showValues) {
          const text = document.createElement("a-entity");
          text.setAttribute(
            "text",
            `value: ${value.toFixed(
              1
            )}; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
          );
          text.setAttribute("position", `${x} 0.2 ${z}`);
          text.setAttribute("scale", "0.4 0.4 0.4");
          text.setAttribute('data-label-type', 'value');
          labelsContainer.appendChild(text);
        }
      }
    }
  }
}

function createLine(start, end) {
  const line = document.createElement("a-cylinder");
  const midPoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };

  const length = Math.sqrt(
    Math.pow(end.x - start.x, 2) +
      Math.pow(end.y - start.y, 2) +
      Math.pow(end.z - start.z, 2)
  );

  const direction = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  };

  const rotation = {
    x:
      (Math.atan2(
        direction.y,
        Math.sqrt(direction.x * direction.x + direction.z * direction.z)
      ) *
        180) /
      Math.PI,
    y: (Math.atan2(direction.x, direction.z) * 180) / Math.PI,
    z: 0,
  };

  line.setAttribute(
    "position",
    `${midPoint.x} ${midPoint.y} ${midPoint.z}`
  );
  line.setAttribute("height", length);
  line.setAttribute("radius", "0.02");
  line.setAttribute(
    "rotation",
    `${rotation.x} ${rotation.y} ${rotation.z}`
  );
  line.setAttribute("material", "color: #ffffff; opacity: 0.5");

  return line;
}

function getHeatColor(intensity) {
  // Convert intensity (0-1) to a color from blue (cold) to red (hot)
  const r = Math.min(255, Math.floor(intensity * 510));
  const b = Math.min(255, Math.floor((1 - intensity) * 510));
  const g = Math.min(
    255,
    Math.floor(Math.min(intensity, 1 - intensity) * 510)
  );

  return `rgb(${r}, ${g}, ${b})`;
}

function createLegend(data) {
  const legendContainer = document.getElementById("legendContainer");
  legendContainer.innerHTML = "";

  if (!config.colorCol) return;

  const colorGroups = [...new Set(data.map((d) => d[config.colorCol]))];

  colorGroups.forEach((group, index) => {
    const y = index * -0.5;

    // Color indicator
    const indicator = document.createElement("a-box");
    indicator.setAttribute("position", `0 ${y} 0`);
    indicator.setAttribute("width", "0.3");
    indicator.setAttribute("height", "0.3");
    indicator.setAttribute("depth", "0.1");
    indicator.setAttribute(
      "material",
      `color: ${colors[index % colors.length]}`
    );
    legendContainer.appendChild(indicator);

    // Label
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${String(
        group
      )}; color: #ffffff; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `0.5 ${y} 0`);
    label.setAttribute("scale", "0.6 0.6 0.6");
    label.setAttribute('data-label-type', 'label');
    legendContainer.appendChild(label);
  });

  // Legend title
  const title = document.createElement("a-entity");
  title.setAttribute(
    "text",
    `value: ${config.colorCol}; color: #ffff00; align: center; baseline: center; wrapCount: 12; shader: msdf`
  );
  title.setAttribute("position", "0 0.5 0");
  title.setAttribute("scale", "0.8 0.8 0.8");
  title.setAttribute('data-label-type', 'label');
  legendContainer.appendChild(title);
}

function updateAxisLabels() {
  if (config.xCol) {
    document
      .getElementById("xAxisLabel")
      .setAttribute("value", config.xCol);
  }
  if (config.yCol) {
    document
      .getElementById("yAxisLabel")
      .setAttribute("value", config.yCol);
  }
}

function updateTitle() {
  // Chart title element removed, so do nothing
}

function getColor(row, colorGroups, index) {
  if (config.colorCol && colorGroups) {
    const groupIndex = colorGroups.indexOf(row[config.colorCol]);
    return colors[groupIndex % colors.length];
  }
  return colors[index % colors.length];
}

function normalize(value, range) {
  if (range[1] === range[0]) return 0.5;
  return (value - range[0]) / (range[1] - range[0]);
}

function clearChart() {
  document.getElementById("dataContainer").innerHTML = "";
  document.getElementById("labelsContainer").innerHTML = "";
  document.getElementById("legendContainer").innerHTML = "";
}

function zoomIn() {
  if (currentZoom > minZoom) {
    // Always use the current camera position approach for consistent behavior
    const cameraRig = document.getElementById("cameraRig");
    const camera = document.getElementById("camera");
    const pos = cameraRig.getAttribute("position");
    const worldDirection = new THREE.Vector3();
    camera.object3D.getWorldDirection(worldDirection);
    worldDirection.normalize();
    // Move by a step (0.5 units)
    const step = 0.5;
    const newX = pos.x + worldDirection.x * -step; // -step for zoom in
    const newY = pos.y + worldDirection.y * -step;
    const newZ = pos.z + worldDirection.z * -step;
    cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
    // Update currentZoom for indicator
    currentZoom = Math.max(minZoom, currentZoom - step);
    updateZoomIndicator();
  }
}

function zoomOut() {
  if (currentZoom < maxZoom) {
    // Always use the current camera position approach for consistent behavior
    const cameraRig = document.getElementById("cameraRig");
    const camera = document.getElementById("camera");
    const pos = cameraRig.getAttribute("position");
    const worldDirection = new THREE.Vector3();
    camera.object3D.getWorldDirection(worldDirection);
    worldDirection.normalize();
    // Move by a step (0.5 units)
    const step = 0.5;
    const newX = pos.x + worldDirection.x * step; // +step for zoom out
    const newY = pos.y + worldDirection.y * step;
    const newZ = pos.z + worldDirection.z * step;
    cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
    // Update currentZoom for indicator
    currentZoom = Math.min(maxZoom, currentZoom + step);
    updateZoomIndicator();
  }
}

function updateCameraPosition() {
  const cameraRig = document.getElementById("cameraRig");
  const camera = document.getElementById("camera");

  if (currentView === "free") {
    // Always reset to initial position and rotation for Free View
    cameraRig.setAttribute("position", "0 1.6 8");
    cameraRig.setAttribute("rotation", "0 0 0");
  } else if (currentView === "front") {
    cameraRig.setAttribute("position", "0 1.6 8");
    cameraRig.setAttribute("rotation", "0 0 0");
  } else if (currentView === "top") {
    cameraRig.setAttribute("position", "0 8 0");
    cameraRig.setAttribute("rotation", "-90 0 0");
  } else if (currentView === "side") {
    cameraRig.setAttribute("position", "8 1.6 0");
    cameraRig.setAttribute("rotation", "0 90 0");
  } else if (currentView === "isometric") {
    cameraRig.setAttribute("position", "8 8 8");
    cameraRig.setAttribute("rotation", "-35 45 0");
  }
}

function resetGraphRotation() {
  const rotationContainer = document.getElementById(
    "graphRotationContainer"
  );
  rotationContainer.setAttribute("rotation", "0 0 0");
  graphRotation = { x: 0, y: 0, z: 0 };
}

function resetView() {
  // Fully reset camera view, zoom, and panning
  currentView = "free";
  currentZoom = defaultZoom;
  lastSliderZoom = defaultZoom;
  const cameraRig = document.getElementById("cameraRig");
  cameraRig.setAttribute("position", "0 1.6 8");
  cameraRig.setAttribute("rotation", "0 0 0");
  // Do NOT call updateCameraPosition() here, to avoid moving the camera far away
  updateZoomIndicator();

  // Reset graph rotation
  resetGraphRotation();
  // (Removed: Unload CSV and clear all data)
  // currentData = [];
  // document.getElementById('csvInput').value = '';
  // document.getElementById('unloadButton').style.display = 'none';
  // Reset dropdowns to default
  // document.getElementById("chartType").selectedIndex = 0;
  // document.getElementById("xColumn").selectedIndex = 0;
  // document.getElementById("yColumn").selectedIndex = 0;
  // document.getElementById("zColumn").selectedIndex = 0;
  // document.getElementById("sizeColumn").selectedIndex = 0;
  // document.getElementById("colorColumn").selectedIndex = 0;
  // Reset checkboxes
  // document.getElementById("showLabels").checked = true;
  // document.getElementById("showValues").checked = true;
  // Hide function input if visible
  // document.getElementById("functionInputGroup").style.display = "none";
  // (Removed: clearChart() to keep the graph visible)
  // clearChart();
  // Reset axis and title labels
  document
    .getElementById("xAxisLabel")
    .setAttribute(
      "text",
      "value: X Axis; color: #ff4757; align: center; baseline: center; wrapCount: 12; shader: msdf"
    );
  document
    .getElementById("yAxisLabel")
    .setAttribute(
      "text",
      "value: Y Axis; color: #2ed573; align: center; baseline: center; wrapCount: 12; shader: msdf"
    );
  // Removed chartTitle reset (element does not exist)
  // Update stats
  updateStats();
  // Hide error/loading
  showError("");
  showLoading(false);
}



function updateStats() {
  const statsEl = document.getElementById("stats");
  if (!currentData.length) {
    statsEl.innerHTML = "Load CSV to see data";
    return;
  }

  const numRows = currentData.length;
  const numCols = Object.keys(currentData[0]).length;

  statsEl.innerHTML = `Rows: ${numRows} | Columns: ${numCols} | Zoom: ${Math.round(
    ((maxZoom - currentZoom) / (maxZoom - minZoom)) * 100
  )}%`;
}

function showLoading(show) {
  document.getElementById("loading").style.display = show
    ? "block"
    : "none";
  // Show spinner on Generate button
  const genBtn = document.getElementById("generateButton");
  if (genBtn) {
    if (show) {
      genBtn.classList.add("loading-spinner");
      genBtn.disabled = true;
    } else {
      genBtn.classList.remove("loading-spinner");
      genBtn.disabled = false;
    }
  }
}

function showError(message) {
  const errorEl = document.getElementById("error");
  errorEl.textContent = message;
  errorEl.style.display = "block";
  setTimeout(() => (errorEl.style.display = "none"), 3000);
}

// Generate sample data for demo
function generateSampleData() {
  const sampleData = [];
  const categories = [];
  const regions = [];

  for (let i = 0; i < 25; i++) {
    sampleData.push({
      ID: i + 1,
      Product: `Product ${String.fromCharCode(65 + (i % 26))}`,
      Category: categories[Math.floor(Math.random() * categories.length)],
      Region: regions[Math.floor(Math.random() * regions.length)],
      Sales: Math.floor(Math.random() * 1000) + 100,
      Profit: Math.floor(Math.random() * 200) + 10,
      Rating: (Math.random() * 4 + 1).toFixed(1),
    });
  }

  return sampleData;
}

// Initialize with sample data
setTimeout(() => {
  currentData = generateSampleData();
  updateColumns();
  updateStats();
  document.getElementById("xColumn").value = "Category";
  document.getElementById("yColumn").value = "Sales";
  if (document.getElementById("colorColumn")) {
    document.getElementById("colorColumn").value = "Region";
  }
  generateChart();
}, 1000);

// Rename the original handler
function baseHandleMouseDown(event) {
  // Always ignore UI elements
  if (isUIElement(event.target)) {
    isInteractingWithUI = true;
    return;
  }
  isInteractingWithUI = false;

  // Shift+Left Click for panning
  if (event.shiftKey && event.button === 0 && currentView === "free") {
    isPanning = true;
    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
    // Disable A-Frame controls during panning by removing attributes
    const cameraEl = document.getElementById("camera");
    cameraEl.removeAttribute("look-controls");
    cameraEl.removeAttribute("wasd-controls");
    event.preventDefault();
  }
  // Middle mouse button for rotation
  else if (event.button === 1) {
    isRotating = true;
    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
    // Disable A-Frame controls during rotation
    const cameraEl = document.getElementById("camera");
    cameraEl.removeAttribute("look-controls");
    cameraEl.removeAttribute("wasd-controls");
    event.preventDefault();
  }
}

// Patch mouse event handlers to support mode toggles
const origHandleMouseDown = baseHandleMouseDown;
handleMouseDown = function(event) {
  // Always ignore UI elements
  if (isUIElement(event.target)) {
    isInteractingWithUI = true;
    return;
  }
  isInteractingWithUI = false;

  if (rotateMode && event.button === 0) {
    isRotating = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    const cameraEl = document.getElementById('camera');
    cameraEl.removeAttribute('look-controls');
    cameraEl.removeAttribute('wasd-controls');
    event.preventDefault();
  } else if (panMode && event.button === 0 && currentView === 'free') {
    isPanning = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    const cameraEl = document.getElementById('camera');
    cameraEl.removeAttribute('look-controls');
    cameraEl.removeAttribute('wasd-controls');
    event.preventDefault();
  } else {
    origHandleMouseDown(event);
  }
};

// Update event listeners to use handleMouseDown
// (If not already, ensure document.addEventListener('mousedown', handleMouseDown); is present)
document.addEventListener("mousedown", handleMouseDown);

function handleMouseMove(event) {
  if (isInteractingWithUI) return;
  if (isUIElement(event.target)) return;
  if (!isPanning && !isRotating) return; // Only handle if panning or rotating

  const deltaMove = {
    x: event.clientX - previousMousePosition.x,
    y: event.clientY - previousMousePosition.y,
  };

  if (isPanning && currentView === "free") {
    // Handle panning
    const cameraRig = document.getElementById("cameraRig");
    const camera = document.getElementById("camera");
    const currentPos = cameraRig.getAttribute("position");

    // Get camera's world right and up vectors in one go
    const worldRight = new THREE.Vector3();
    const worldUp = new THREE.Vector3();
    const worldForward = new THREE.Vector3();
    camera.object3D.matrixWorld.extractBasis(
      worldRight,
      worldUp,
      worldForward
    );

    // Pan speed factor - inversely proportional to zoom for consistent feel
    const panSpeed = 0.001 * currentZoom;

    // Calculate new position based on camera's world orientation
    const newX =
      currentPos.x -
      worldRight.x * deltaMove.x * panSpeed +
      worldUp.x * deltaMove.y * panSpeed;
    const newY =
      currentPos.y -
      worldRight.y * deltaMove.x * panSpeed +
      worldUp.y * deltaMove.y * panSpeed;
    const newZ =
      currentPos.z -
      worldRight.z * deltaMove.x * panSpeed +
      worldUp.z * deltaMove.y * panSpeed;

    cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
  } else if (isRotating) {
    // Handle rotation of the graph
    const rotationContainer = document.getElementById(
      "graphRotationContainer"
    );
    const currentRotation = rotationContainer.getAttribute("rotation");

    // Update rotation based on mouse movement
    // X movement affects Y rotation (horizontal mouse movement rotates around Y axis)
    // Y movement affects X rotation (vertical mouse movement rotates around X axis)
    const newRotX = currentRotation.x + deltaMove.y * rotationSpeed * 0.3;
    const newRotY = currentRotation.y + deltaMove.x * rotationSpeed * 0.3;

    rotationContainer.setAttribute(
      "rotation",
      `${newRotX} ${newRotY} ${currentRotation.z}`
    );

    // Update global rotation state
    graphRotation.x = newRotX;
    graphRotation.y = newRotY;
    graphRotation.z = currentRotation.z;
  }

  previousMousePosition = {
    x: event.clientX,
    y: event.clientY,
  };

  event.preventDefault();
}

function handleMouseUp(event) {
  if (isInteractingWithUI) {
    isInteractingWithUI = false;
    return;
  }
  if (isUIElement(event.target)) return;
  isPanning = false;
  isRotating = false;
  // Re-enable A-Frame controls after interaction
  const cameraEl = document.getElementById("camera");
  cameraEl.setAttribute("look-controls", "");
  cameraEl.setAttribute("wasd-controls", "");
}

// Touch event handlers for mobile panning (one finger drag)

function handleTouchStart(event) {
  if (isUIElement(event.target)) {
    isInteractingWithUI = true;
    return;
  }
  isInteractingWithUI = false;
  if (event.touches.length === 1) {
    previousMousePosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
    if (rotateMode) {
      isRotating = true;
      isPanning = false;
    } else if (panMode || currentView === "free") {
      isPanning = true;
      isRotating = false;
    }
    // Disable A-Frame controls during interaction
    const cameraEl = document.getElementById("camera");
    cameraEl.removeAttribute("look-controls");
    cameraEl.removeAttribute("wasd-controls");
  } else if (event.touches.length === 2) {
    // Pinch start
    lastPinchDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    // Prevent default browser zoom
    event.preventDefault();
  }
}

function handleTouchMove(event) {
  if (isInteractingWithUI) return;
  if (isUIElement(event.target)) return;
  if (event.touches.length === 1) {
    const deltaMove = {
      x: event.touches[0].clientX - previousMousePosition.x,
      y: event.touches[0].clientY - previousMousePosition.y,
    };
    if (isPanning && (panMode || currentView === "free")) {
      const cameraRig = document.getElementById("cameraRig");
      const camera = document.getElementById("camera");
      const currentPos = cameraRig.getAttribute("position");
      const worldRight = new THREE.Vector3();
      const worldUp = new THREE.Vector3();
      const worldForward = new THREE.Vector3();
      camera.object3D.matrixWorld.extractBasis(
        worldRight,
        worldUp,
        worldForward
      );
      const panSpeed = 0.001 * currentZoom;
      const newX =
        currentPos.x -
        worldRight.x * deltaMove.x * panSpeed +
        worldUp.x * deltaMove.y * panSpeed;
      const newY =
        currentPos.y -
        worldRight.y * deltaMove.x * panSpeed +
        worldUp.y * deltaMove.y * panSpeed;
      const newZ =
        currentPos.z -
        worldRight.z * deltaMove.x * panSpeed +
        worldUp.z * deltaMove.y * panSpeed;
      cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
    } else if (isRotating && rotateMode) {
      const rotationContainer = document.getElementById("graphRotationContainer");
      const currentRotation = rotationContainer.getAttribute("rotation");
      const newRotX = currentRotation.x + deltaMove.y * rotationSpeed * 0.3;
      const newRotY = currentRotation.y + deltaMove.x * rotationSpeed * 0.3;
      rotationContainer.setAttribute(
        "rotation",
        `${newRotX} ${newRotY} ${currentRotation.z}`
      );
      graphRotation.x = newRotX;
      graphRotation.y = newRotY;
      graphRotation.z = currentRotation.z;
    }
    previousMousePosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  } else if (event.touches.length === 2) {
    // Pinch to zoom
    const pinchDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    if (lastPinchDistance !== null) {
      const delta = pinchDistance - lastPinchDistance;
      if (Math.abs(delta) > 2) {
        // Use the same approach as zoomIn/zoomOut for consistent behavior
        const cameraRig = document.getElementById("cameraRig");
        const camera = document.getElementById("camera");
        const pos = cameraRig.getAttribute("position");
        const worldDirection = new THREE.Vector3();
        camera.object3D.getWorldDirection(worldDirection);
        worldDirection.normalize();
        
        // Calculate zoom step based on delta
        const zoomStep = delta * 0.01; // Adjust sensitivity
        const step = Math.abs(zoomStep);
        
        if (delta > 0) {
          // Zoom in
          if (currentZoom > minZoom) {
            const newX = pos.x + worldDirection.x * -step;
            const newY = pos.y + worldDirection.y * -step;
            const newZ = pos.z + worldDirection.z * -step;
            cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
            currentZoom = Math.max(minZoom, currentZoom - step);
          }
        } else {
          // Zoom out
          if (currentZoom < maxZoom) {
            const newX = pos.x + worldDirection.x * step;
            const newY = pos.y + worldDirection.y * step;
            const newZ = pos.z + worldDirection.z * step;
            cameraRig.setAttribute("position", `${newX} ${newY} ${newZ}`);
            currentZoom = Math.min(maxZoom, currentZoom + step);
          }
        }
        
        updateZoomIndicator();
        lastPinchDistance = pinchDistance;
      }
    } else {
      lastPinchDistance = pinchDistance;
    }
    // Prevent default browser zoom
    event.preventDefault();
  }
}

function handleTouchEnd(event) {
  if (isInteractingWithUI) {
    isInteractingWithUI = false;
    return;
  }
  if (isUIElement(event.target)) return;
  isPanning = false;
  isRotating = false;
  lastPinchDistance = null;
  // Re-enable A-Frame controls after interaction
  const cameraEl = document.getElementById("camera");
  cameraEl.setAttribute("look-controls", "");
  cameraEl.setAttribute("wasd-controls", "");
}

// View mode variables
let currentView = "free";
const viewPositions = {
  front: { position: "0 1.6 8", rotation: "0 0 0" },
  top: { position: "0 8 0", rotation: "-90 0 0" },
  side: { position: "8 1.6 0", rotation: "0 90 0" },
  isometric: { position: "8 8 8", rotation: "-35 45 0" },
  free: { position: "0 1.6 8", rotation: "0 0 0" },
};

function setView(view) {
  currentView = view;
  const cameraRig = document.getElementById("cameraRig");
  const viewConfig = viewPositions[view];

  // Only update camera rotation, not zoom
  cameraRig.setAttribute("rotation", viewConfig.rotation);

  // Update button states
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.remove("active");
    if (button.textContent.toLowerCase().includes(view)) {
      button.classList.add("active");
    }
  });

  // Update camera position to preserve currentZoom (distance from graph)
  updateCameraPosition();
}

// In script, add event listener for chartType to show/hide function input
document
  .getElementById("chartType")
  .addEventListener("change", function () {
    const isFunction = this.value === "function";
    document.getElementById("functionInputGroup").style.display =
      isFunction ? "" : "none";
    document.getElementById("equationDropdownGroup").style.display = isFunction ? "" : "none";
  });

// Populate the function input when an equation is selected
const equationDropdown = document.getElementById("equationDropdown");
if (equationDropdown) {
  equationDropdown.addEventListener("change", function () {
    if (this.value) {
      document.getElementById("functionInput").value = this.value;
    }
  });
}

// Add createFunctionPlot function
function createFunctionPlot() {
  const container = document.getElementById("dataContainer");
  const labelsContainer = document.getElementById("labelsContainer");
  const funcInput = document.getElementById("functionInput").value;
  const funcLines = funcInput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Colors for multiple plots
  const plotColors = [
    "#ffeb3b",
    "#4ECDC4",
    "#FF6B6B",
    "#45B7D1",
    "#DDA0DD",
    "#FF8A65",
    "#A8E6CF",
    "#FFEAA7",
  ];

  funcLines.forEach((line, idx) => {
    const color = plotColors[idx % plotColors.length];
    // Treat 'y = ...' as a 2D function plot
    if (/^y\s*=/.test(line)) {
      const rhs = line.split('=')[1].trim();
      createSingleFunctionPlot(rhs, color);
    } else if (
      line.includes("y") &&
      !line.includes("=") &&
      !line.match(/^y\s*=|^y\s*=/i)
    ) {
      create3DFunctionPlot(line, color);
    } else if (line.includes("=")) {
      createGeneralEquationPlot(line, color);
    } else {
      createSingleFunctionPlot(line, color);
    }
  });

  // Add axis labels for 3D functions
  if (
    funcLines.some((line) => line.includes("y") && !line.includes("="))
  ) {
    add3DAxisLabels();
  } else {
    add2DAxisLabels();
  }
}

function createSingleFunctionPlot(funcStr, color = "#ffeb3b") {
  const container = document.getElementById("dataContainer");
  const mathFunc = parseMathFunction(funcStr);
  const points = [];
  // Get range from UI (symmetric limits)
  const xLimit = parseFloat(document.getElementById('xLimit')?.value) ?? 10;
  const yLimit = parseFloat(document.getElementById('yLimit')?.value) ?? 20;
  const xMin = -Math.abs(xLimit);
  const xMax = Math.abs(xLimit);
  const yMin = -Math.abs(yLimit);
  const yMax = Math.abs(yLimit);
  const step = 0.07;

  for (let x = xMin; x <= xMax; x += step) {
    let y = 0;
    try {
      y = mathFunc(x);
      // Only add points within reasonable bounds
      if (y >= yMin && y <= yMax) {
        points.push({ x, y, z: 0 });
      }
    } catch (e) {
      continue;
    }
  }

  // Draw as a smooth line using aframe-line-component between each pair
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const line = document.createElement("a-entity");
    line.setAttribute("line", {
      start: `${p1.x} ${p1.y} ${p1.z}`,
      end: `${p2.x} ${p2.y} ${p2.z}`,
      color: color,
      opacity: 0.95
    });
    container.appendChild(line);
  }

  // Add points at regular intervals for visual reference
  points.forEach((p, idx) => {
    if (idx % 50 === 0) {
      const pt = document.createElement("a-sphere");
      pt.setAttribute("position", `${p.x} ${p.y} ${p.z}`);
      pt.setAttribute("radius", "0.04");
      pt.setAttribute("material", `color: ${color}; metalness: 0.3`);
      container.appendChild(pt);
    }
  });
}

function createGeneralEquationPlot(equation, color = "#ffeb3b") {
  const container = document.getElementById("dataContainer");
  const points = [];
  // Get range from UI (symmetric limits)
  const xLimit = parseFloat(document.getElementById('xLimit')?.value) ?? 10;
  const yLimit = parseFloat(document.getElementById('yLimit')?.value) ?? 10;
  const xMin = -Math.abs(xLimit);
  const xMax = Math.abs(xLimit);
  const yMin = -Math.abs(yLimit);
  const yMax = Math.abs(yLimit);
  const step = 0.04; // smaller step for smoother curves

  // Preprocess: replace ^ with ** for JS power
  equation = equation.replace(/\^/g, "**");

  // Parse the equation
  const [leftSideRaw, rightSideRaw] = equation.split("=");
  if (!leftSideRaw || !rightSideRaw) return;
  const leftSide = leftSideRaw.trim();
  const rightSide = rightSideRaw.trim();

  // Robust detection for y=... or x=... (allow spaces, case-insensitive)
  if (/^y\s*$/i.test(leftSide)) {
    // y = f(x)
    const mathFunc = parseMathFunction(rightSide, 'x');
    for (let x = xMin; x <= xMax; x += step) {
      let y;
      try {
        y = mathFunc(x);
        if (isFinite(y) && y >= yMin && y <= yMax) {
          points.push({ x, y, z: 0 });
        }
      } catch (e) {
        continue;
      }
    }
  } else if (/^x\s*$/i.test(leftSide)) {
    // x = f(y)
    const mathFunc = parseMathFunction(rightSide, 'y');
    for (let y = yMin; y <= yMax; y += step) {
      let x;
      try {
        x = mathFunc(y);
        if (isFinite(x) && x >= xMin && x <= xMax) {
          points.push({ x, y, z: 0 });
        }
      } catch (e) {
        continue;
      }
    }
    // Sort points by y for smooth curve
    points.sort((a, b) => a.y - b.y);
    // Draw as a smooth line using aframe-line-component between each pair, only if close
    const distanceThreshold = 1.5; // Only connect points that are close
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < distanceThreshold) {
        const line = document.createElement("a-entity");
        line.setAttribute("line", {
          start: `${p1.x} ${p1.y} ${p1.z}`,
          end: `${p2.x} ${p2.y} ${p2.z}`,
          color: color,
          opacity: 0.95
        });
        container.appendChild(line);
      }
    }
  } else {
    // Implicit equation: grid search
    let errorMargin = 0.03;
    // Try to adapt errorMargin for circle-like equations
    const rMatch = rightSide.match(/^([0-9.]+)/);
    if (rMatch) {
      const r = Math.sqrt(Number(rMatch[1]));
      errorMargin = Math.max(0.03, 0.03 * r);
    }
    const seen = new Set();
    for (let x = xMin; x <= xMax; x += step) {
      for (let y = yMin; y <= yMax; y += step) {
        try {
          // Replace ^ with ** in both sides
          const leftEval = eval(
            leftSide
              .replace(/\^/g, "**")
              .replace(/x/g, `(${x})`)
              .replace(/y/g, `(${y})`)
          );
          const rightEval = eval(
            rightSide
              .replace(/\^/g, "**")
              .replace(/x/g, `(${x})`)
              .replace(/y/g, `(${y})`)
          );
          if (Math.abs(leftEval - rightEval) < errorMargin) {
            const key = `${x.toFixed(2)},${y.toFixed(2)}`;
            if (!seen.has(key)) {
              points.push({ x, y, z: 0 });
              seen.add(key);
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    // Always treat implicit equations as closed curves
    if (points.length > 2) {
      let cx = 0, cy = 0;
      for (const p of points) { cx += p.x; cy += p.y; }
      cx /= points.length; cy /= points.length;
      points.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    }
    // Draw as a smooth line using aframe-line-component between each pair
    const distanceThreshold = 1.5;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < distanceThreshold) {
        const line = document.createElement("a-entity");
        line.setAttribute("line", {
          start: `${p1.x} ${p1.y} ${p1.z}`,
          end: `${p2.x} ${p2.y} ${p2.z}`,
          color: color,
          opacity: 0.95
        });
        container.appendChild(line);
      }
    }
    // Always connect last to first for implicit (closed) curves
    if (points.length > 2) {
      const p1 = points[points.length - 1];
      const p2 = points[0];
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < distanceThreshold) {
        const line = document.createElement("a-entity");
        line.setAttribute("line", {
          start: `${p1.x} ${p1.y} ${p1.z}`,
          end: `${p2.x} ${p2.y} ${p2.z}`,
          color: color,
          opacity: 0.95
        });
        container.appendChild(line);
      }
    }
    return;
  }
}

function parseMathFunction(str, variable = 'x') {
  // Only allow math functions and the chosen variable
  const allowed = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "sqrt",
    "abs",
    "log",
    "exp",
    "pow",
    "PI",
    "E",
    variable,
  ];
  const safeStr = str.replace(/[^a-zA-Z0-9_\.\+\-\*\/\(\)\, ]/g, "");

  // eslint-disable-next-line no-new-func
  return new Function(
    variable,
    `
with (Math) {
  const sec = (x) => 1 / cos(x);
  const cosec = (x) => 1 / sin(x);
  const cot = (x) => 1 / tan(x);
  return ${safeStr};
}
`
  );
}

function parse3DMathFunction(str) {
  // Preprocess: replace ^ with ** for JS power
  str = str.replace(/\^/g, "**");

  // Only allow math functions and x, y
  const allowed = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "sqrt",
    "abs",
    "log",
    "exp",
    "pow",
    "PI",
    "E",
    "x",
    "y",
  ];
  const safeStr = str.replace(/[^a-zA-Z0-9_\.\+\-\*\/\(\)\, ]/g, "");

  // eslint-disable-next-line no-new-func
  return new Function(
    "x",
    "y",
    `
with (Math) {
  const sec = (x) => 1 / cos(x);
  const cosec = (x) => 1 / sin(x);
  const cot = (x) => 1 / tan(x);
  return ${safeStr};
}
`
  );
}

console.log(
  "Enhanced VR Data Visualizer Ready - Now with Zoom, Labels & VR Toggle!"
);

// Test 3D function parsing
try {
  const testFunc = parse3DMathFunction("sin(x^2 + y^2) - cos(x - y)");
  const testResult = testFunc(1, 1);
  console.log("3D function test result:", testResult);
} catch (e) {
  console.error("3D function parsing test failed:", e);
}

function unloadCSV() {
  // Clear the file input
  document.getElementById("csvInput").value = "";

  // Hide unload button
  document.getElementById("unloadButton").style.display = "none";

  // Clear data and reset everything
  currentData = [];
  clearChart();

  // Reset dropdowns to default
  document.getElementById("xColumn").innerHTML =
    "<option>Select X</option>";
  document.getElementById("yColumn").innerHTML =
    "<option>Select Y</option>";
  document.getElementById("zColumn").innerHTML = "<option>None</option>";
  document.getElementById("sizeColumn").innerHTML =
    "<option>None</option>";
  if (document.getElementById("colorColumn")) {
    document.getElementById("colorColumn").innerHTML =
      "<option>None</option>";
  }

  // Reset axis and title labels
  document
    .getElementById("xAxisLabel")
    .setAttribute(
      "text",
      "value: X Axis; color: #ff4757; align: center; baseline: center; wrapCount: 12; shader: msdf"
    );
  document
    .getElementById("yAxisLabel")
    .setAttribute(
      "text",
      "value: Y Axis; color: #2ed573; align: center; baseline: center; wrapCount: 12; shader: msdf"
    );
  // Removed chartTitle reset (element does not exist)
  // Update stats
  updateStats();

  // Hide error/loading
  showError("");
  showLoading(false);
}

// Add this function to draw the XZ grid
function createXZFloorGrid() {
  const gridEntity = document.getElementById("floorGrid");
  if (!gridEntity) return;
  gridEntity.innerHTML = "";
  // Use grid size from slider as half-width of grid
  const gridHalf = Math.round(parseFloat(document.getElementById('gridSizeSlider')?.value) || 20);
  const min = -gridHalf, max = gridHalf, step = 1;
  // Draw lines parallel to X (varying Z)
  for (let z = min; z <= max; z += step) {
    const line = document.createElement("a-entity");
    line.setAttribute("line", {
      start: `${min} 0 ${z}`,
      end: `${max} 0 ${z}`,
      color: Math.abs(z) < 0.001 ? '#ffffff' : '#888',
      opacity: Math.abs(z) < 0.001 ? 0.7 : 0.3,
    });
    gridEntity.appendChild(line);
  }
  // Draw lines parallel to Z (varying X)
  for (let x = min; x <= max; x += step) {
    const line = document.createElement("a-entity");
    line.setAttribute("line", {
      start: `${x} 0 ${min}`,
      end: `${x} 0 ${max}`,
      color: Math.abs(x) < 0.001 ? '#ffffff' : '#888',
      opacity: Math.abs(x) < 0.001 ? 0.7 : 0.3,
    });
    gridEntity.appendChild(line);
  }
}


let rotateMode = false;
let panMode = false;

function toggleRotateMode() {
  rotateMode = !rotateMode;
  panMode = false;
  updateModeButtons();
}

function togglePanMode() {
  panMode = !panMode;
  rotateMode = false;
  updateModeButtons();
}

function updateModeButtons() {
  const rotateBtn = document.getElementById('rotateModeBtn');
  const panBtn = document.getElementById('panModeBtn');
  // Only update active style, not icon
  if (rotateMode) {
    rotateBtn.classList.add('active');
  } else {
    rotateBtn.classList.remove('active');
  }
  if (panMode) {
    panBtn.classList.add('active');
  } else {
    panBtn.classList.remove('active');
  }
}

// Sidebar toggle logic
const sidebar = document.querySelector('.control-panel');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarArrow = document.getElementById('sidebarArrow');
let sidebarHidden = true; // Hide sidebar by default

function updateSidebarToggleBtnPosition() {
  const sidebar = document.querySelector('.control-panel');
  const btn = document.querySelector('.sidebar-toggle-btn');
  if (!btn || !sidebar) return;
  if (document.body.classList.contains('sidebar-open')) {
    btn.style.left = (sidebar.offsetLeft + sidebar.offsetWidth) + 'px';
  } else {
    btn.style.left = '0px';
  }
}

// Update sidebar toggle logic to call this function
sidebarToggleBtn.addEventListener('click', function() {
  sidebarHidden = !sidebarHidden;
  if (sidebarHidden) {
    sidebar.style.transform = 'translateX(-110%)';
    sidebar.style.transition = 'transform 0.4s cubic-bezier(.77,0,.18,1)';
    sidebarToggleBtn.title = 'Show sidebar';
    // Change arrow to right
    sidebarArrow.setAttribute('points', '12,8 20,16 12,24');
    document.body.classList.remove('sidebar-open');
  } else {
    sidebar.style.transform = 'translateX(0)';
    sidebar.style.transition = 'transform 0.4s cubic-bezier(.77,0,.18,1)';
    sidebarToggleBtn.title = 'Hide sidebar';
    // Change arrow to left
    sidebarArrow.setAttribute('points', '20,8 12,16 20,24');
    document.body.classList.add('sidebar-open');
  }
  updateSidebarToggleBtnPosition();
});

window.addEventListener('resize', updateSidebarToggleBtnPosition);
window.addEventListener('DOMContentLoaded', updateSidebarToggleBtnPosition);

// On DOMContentLoaded, hide sidebar initially
window.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.querySelector('.control-panel');
  sidebar.style.transform = 'translateX(-110%)';
  sidebar.style.transition = 'transform 0.4s cubic-bezier(.77,0,.18,1)';
  sidebarToggleBtn.title = 'Show sidebar';
  // Change arrow to right
  sidebarArrow.setAttribute('points', '12,8 20,16 12,24');
  document.body.classList.remove('sidebar-open');

  // Nudge animation for first-time users
  if (sidebarHidden) {
    sidebarToggleBtn.classList.add('nudge-animate');
    setTimeout(() => {
      sidebarToggleBtn.classList.remove('nudge-animate');
    }, 2400); // 2 cycles of 1.2s each
  }
});

// --- Robust Error Handling for Network and JS Errors ---
window.addEventListener('offline', function() {
  showError('You are offline. Some features may not work.');
});
window.addEventListener('online', function() {
  showError('You are back online.');
});
if (!navigator.onLine) {
  showError('You are currently offline.');
}

window.onerror = function(message, source, lineno, colno, error) {
  showError('An unexpected error occurred: ' + message);
  return false; // Let the browser log it as well
};
window.addEventListener('unhandledrejection', function(event) {
  showError('A promise error occurred: ' + (event.reason && event.reason.message ? event.reason.message : event.reason));
});

// Helper to get display name for view
function getViewDisplayName(view) {
  switch (view) {
    case 'front': return 'Front View';
    case 'top': return 'Top View';
    case 'side': return 'Side View';
    case 'isometric': return 'Isometric View';
    case 'free': return 'Free View';
    default: return '';
  }
}

// Update view mode text
function updateViewModeText() {
  const textEl = document.getElementById('viewModeText');
  if (textEl) textEl.textContent = getViewDisplayName(currentView);
}

// Patch setView to update the text
const origSetView = setView;
setView = function(view) {
  origSetView(view);
  updateViewModeText();
};

// On DOMContentLoaded, set initial view mode text
window.addEventListener('DOMContentLoaded', function() {
  updateViewModeText();
});

// --- Grid and Axis Size Controls ---
function updateGridSize() {
  const gridSize = parseFloat(document.getElementById('gridSizeSlider').value);
  // Update all grid lines (floorGrid)
  const grid = document.getElementById('floorGrid');
  if (grid) {
    Array.from(grid.children).forEach(lineEntity => {
      if (lineEntity.hasAttribute('line')) {
        // The aframe-line-component does not have thickness, so we can optionally add a cylinder for thickness
        // But if you use a custom line renderer, set thickness here
        // For now, do nothing (aframe-line-component is always 1px)
      } else if (lineEntity.tagName === 'A-CYLINDER') {
        lineEntity.setAttribute('radius', 0.01 * gridSize);
      }
    });
  }
}

function updateAxisSize() {
  const axisSize = parseFloat(document.getElementById('axisSizeSlider').value);
  // Update the three axis cylinders in axesContainer
  const axes = document.getElementById('axesContainer');
  if (axes && axes.children.length >= 5) {
    // X, Y, Z axis cylinders are children 0, 2, 4
    axes.children[0].setAttribute('height', 4 * axisSize);
    axes.children[2].setAttribute('height', 4 * axisSize);
    axes.children[4].setAttribute('height', 4 * axisSize);
    // Also update their positions so they remain centered
    axes.children[0].setAttribute('position', `${2 * axisSize} 0 0`);
    axes.children[2].setAttribute('position', `0 ${2 * axisSize} 0`);
    axes.children[4].setAttribute('position', `0 0 ${2 * axisSize}`);
    // Update axis labels' positions
    document.getElementById('xAxisLabel').setAttribute('position', `${4.5 * axisSize} 0 0`);
    document.getElementById('yAxisLabel').setAttribute('position', `0 ${4.5 * axisSize} 0`);
    // Z label is the 3rd a-entity after the Z cylinder
    const zLabel = axes.children[6];
    if (zLabel) zLabel.setAttribute('position', `0 0 ${4.5 * axisSize}`);
  }
}

document.getElementById('gridSizeSlider').addEventListener('input', function() {
  createXZFloorGrid();
});
document.getElementById('axisSizeSlider').addEventListener('input', updateAxisSize);

// Call these after chart generation and view reset
const origGenerateChart = generateChart;
generateChart = function() {
  origGenerateChart();
  createXZFloorGrid();
  updateAxisSize();
};

const origResetView = resetView;
resetView = function() {
  origResetView();
  createXZFloorGrid();
  updateAxisSize();
};

function updateZoomIndicator() {
  const zoomPercentage = Math.round(
    ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100
  );
  zoomIndicator.textContent = `Zoom: ${zoomPercentage}%`;

  // Show warning when zoomed very close
  if (currentZoom < 2) {
    zoomIndicator.style.background = "rgba(255, 0, 0, 0.7)";
    zoomIndicator.style.display = "block";
  } else {
    zoomIndicator.style.background = "rgba(0, 0, 0, 0.7)";
    zoomIndicator.style.display = "block";
  }

  // Hide indicator after 2 seconds if not in warning state
  if (currentZoom >= 2) {
    setTimeout(() => {
      if (currentZoom >= 2) {
        zoomIndicator.style.display = "none";
      }
    }, 2000);
  }

  const zoomSlider = document.getElementById("zoomSlider");
  if (zoomSlider) {
    // Invert the value for reversed direction
    zoomSlider.value = maxZoom - (currentZoom - minZoom);
    lastSliderZoom = currentZoom;
  }
}

// Utility function to check if event target is a UI element
function isUIElement(target) {
  return (
    target.closest && (
      target.closest('.control-panel') ||
      target.closest('.zoom-slider-container') ||
      target.closest('.zoom-controls')
    ) ||
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'BUTTON' ||
    target.tagName === 'TEXTAREA'
  );
}

let isInteractingWithUI = false;

function add2DAxisLabels() {
  const labelsContainer = document.getElementById("labelsContainer");
  const xMin = -10,
    xMax = 10;
  const yMin = -10,
    yMax = 10;

  // X-axis value labels
  for (let x = xMin; x <= xMax; x += 2) {
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${x}; color: #ff4757; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `${x} -0.3 0`);
    label.setAttribute("scale", "0.4 0.4 0.4");
    labelsContainer.appendChild(label);
  }

  // Y-axis value labels
  for (let y = yMin; y <= yMax; y += 2) {
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${y}; color: #2ed573; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `-0.3 ${y} 0`);
    label.setAttribute("scale", "0.4 0.4 0.4");
    labelsContainer.appendChild(label);
  }
}

function create3DFunctionPlot(funcStr, color = "#ffeb3b") {
  const container = document.getElementById("dataContainer");
  const mathFunc = parse3DMathFunction(funcStr);
  const xMin = -5, xMax = 5, yMin = -5, yMax = 5;

  // Get detail level setting
  const detailLevel = document.getElementById("detailLevel").value;
  let step, contourStep;
  switch (detailLevel) {
    case "low": step = 1.0; contourStep = 2.0; break;
    case "high": step = 0.1; contourStep = 0.2; break;
    case "ultra": step = 0.05; contourStep = 0.1; break;
    default: step = 0.5; contourStep = 1.0;
  }

  // Generate 3D surface points as a 2D grid
  const gridPoints = [];
  const points = [];
  for (let xi = 0, x = xMin; x <= xMax + 0.0001; xi++, x += step) {
    const row = [];
    for (let yi = 0, y = yMin; y <= yMax + 0.0001; yi++, y += step) {
      let z = 0;
      try {
        z = mathFunc(x, y);
        if (isFinite(z) && z >= -10 && z <= 10) {
          row.push({ x, y, z });
          points.push({ x, y, z });
        } else {
          row.push(null);
        }
      } catch (e) {
        row.push(null);
      }
    }
    gridPoints.push(row);
  }

  // Draw mesh lines between adjacent points in the grid
  for (let i = 0; i < gridPoints.length; i++) {
    for (let j = 0; j < gridPoints[i].length; j++) {
      const p = gridPoints[i][j];
      if (!p) continue;
      // Line to right neighbor
      if (j < gridPoints[i].length - 1 && gridPoints[i][j + 1]) {
        const p2 = gridPoints[i][j + 1];
        const line = document.createElement("a-entity");
        line.setAttribute("line", {
          start: `${p.x} ${p.y} ${p.z}`,
          end: `${p2.x} ${p2.y} ${p2.z}`,
          color: color,
          opacity: 0.7
        });
        container.appendChild(line);
      }
      // Line to bottom neighbor
      if (i < gridPoints.length - 1 && gridPoints[i + 1][j]) {
        const p2 = gridPoints[i + 1][j];
        const line = document.createElement("a-entity");
        line.setAttribute("line", {
          start: `${p.x} ${p.y} ${p.z}`,
          end: `${p2.x} ${p2.y} ${p2.z}`,
          color: color,
          opacity: 0.7
        });
        container.appendChild(line);
      }
    }
  }

  // Add points at regular intervals for visual reference
  points.forEach((p, idx) => {
    if (idx % 100 === 0) {
      const sphere = document.createElement("a-sphere");
      sphere.setAttribute("position", `${p.x} ${p.y} ${p.z}`);
      sphere.setAttribute("radius", "0.05");
      sphere.setAttribute("material", `color: ${color}; metalness: 0.5; roughness: 0.3`);
      container.appendChild(sphere);
    }
  });
}

function add3DAxisLabels() {
  const labelsContainer = document.getElementById("labelsContainer");
  const xMin = -5, xMax = 5, yMin = -5, yMax = 5;

  // X-axis value labels
  for (let x = xMin; x <= xMax; x += 1) {
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${x}; color: #ff4757; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `${x} -0.3 0`);
    label.setAttribute("scale", "0.4 0.4 0.4");
    label.setAttribute('data-label-type', 'label');
    labelsContainer.appendChild(label);
  }

  // Y-axis value labels
  for (let y = yMin; y <= yMax; y += 1) {
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${y}; color: #2ed573; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `-0.3 0 ${y}`);
    label.setAttribute("scale", "0.4 0.4 0.4");
    labelsContainer.appendChild(label);
  }

  // Z-axis value labels (on a vertical line)
  for (let z = -3; z <= 3; z += 1) {
    const label = document.createElement("a-entity");
    label.setAttribute(
      "text",
      `value: ${z}; color: #3742fa; align: center; baseline: center; wrapCount: 12; shader: msdf`
    );
    label.setAttribute("position", `-0.3 ${z} 0`);
    label.setAttribute("scale", "0.4 0.4 0.4");
    labelsContainer.appendChild(label);
  }
}

let gyroEnabled = false;

function toggleGyroControl() {
  const cameraEl = document.getElementById("camera");
  const gyroBtn = document.getElementById('gyroToggleBtn');
  if (!gyroEnabled) {
    // Enable gyro: add attribute if missing, then play
    if (!cameraEl.hasAttribute('look-controls')) {
      cameraEl.setAttribute('look-controls', '');
    }
    // Wait for component to be available, then play
    setTimeout(() => {
      if (cameraEl.components && cameraEl.components['look-controls']) {
        cameraEl.components['look-controls'].play();
      }
    }, 0);
    gyroEnabled = true;
    if (gyroBtn) gyroBtn.classList.add('active');
  } else {
    // Disable gyro: pause the component if present
    if (cameraEl.components && cameraEl.components['look-controls']) {
      cameraEl.components['look-controls'].pause();
    }
    // Optionally remove the attribute
    cameraEl.removeAttribute('look-controls');
    gyroEnabled = false;
    if (gyroBtn) gyroBtn.classList.remove('active');
  }
}
