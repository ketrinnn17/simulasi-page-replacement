// ====== script.js (versi "bersih" tanpa Dirty Bit / Clock / LFU / Cost) ======

// Variabel global untuk simulasi
let currentAlgorithm = "fifo";
let frameCount = 3;
let referenceString = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
let memoryFrames = [];
let currentStep = 0;
let hitCount = 0;
let missCount = 0;
let simulationInterval;
let isSimulationRunning = false;
let simulationSpeed = 5;
let timelineData = [];

// Antrian untuk FIFO dan LRU
let fifoQueue = [];
let lruQueue = [];

// Statistik per-algoritma (disimpan untuk tampilan perbandingan)
let algorithmStats = {
  fifo: { hits: 0, misses: 0 },
  lru: { hits: 0, misses: 0 },
  optimal: { hits: 0, misses: 0 },
};

// Chart instances
let performanceChart;
let comparisonChart;

// Inisialisasi halaman
document.addEventListener("DOMContentLoaded", function () {
  initializePage();
  setupEventListeners();
  initializeCharts();
  renderMemoryFrames();
  renderReferenceString();
  updateStatistics();
});

function initializePage() {
  // Set nilai awal (cek elemen ada)
  const fv = document.getElementById("frame-value");
  if (fv) fv.textContent = frameCount;

  const cfv = document.getElementById("comparison-frame-value");
  if (cfv) cfv.textContent = frameCount;

  const ri = document.getElementById("reference-input");
  if (ri) ri.value = referenceString.join(",");

  const cri = document.getElementById("comparison-reference");
  if (cri) cri.value = referenceString.join(",");

  const sv = document.getElementById("speed-value");
  if (sv) sv.textContent = simulationSpeed;

  // Set algoritma aktif (cek button ada)
  setAlgorithm("fifo");
}

function setupEventListeners() {
  // === Auto Highlight Navbar Saat Scroll ===
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll('header a[href^="#"]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        const link = document.querySelector(`header a[href="#${id}"]`);
        if (!link) return;
        if (entry.isIntersecting) {
          // Hapus aktif dari semua
          navLinks.forEach((l) => {
            l.classList.remove("text-primary", "font-semibold");
            l.classList.add("text-gray-400");
          });
          // Tambahkan aktif ke yang sedang terlihat
          link.classList.add("text-primary", "font-semibold");
          link.classList.remove("text-gray-400");
        }
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((section) => observer.observe(section));

  // Tombol algoritma (cek ada sebelum pasang listener)
  const fifoBtn = document.getElementById("fifo-btn");
  const lruBtn = document.getElementById("lru-btn");
  const optimalBtn = document.getElementById("optimal-btn");
  if (fifoBtn) fifoBtn.addEventListener("click", () => setAlgorithm("fifo"));
  if (lruBtn) lruBtn.addEventListener("click", () => setAlgorithm("lru"));
  if (optimalBtn)
    optimalBtn.addEventListener("click", () => setAlgorithm("optimal"));

  // Slider frame
  const frameSlider = document.getElementById("frame-slider");
  if (frameSlider) {
    frameSlider.addEventListener("input", function () {
      frameCount = parseInt(this.value);
      const fv = document.getElementById("frame-value");
      if (fv) fv.textContent = frameCount;
      resetSimulation();
      renderMemoryFrames();
    });
  }

  const compFrameSlider = document.getElementById("comparison-frame-slider");
  if (compFrameSlider) {
    compFrameSlider.addEventListener("input", function () {
      const cfv = document.getElementById("comparison-frame-value");
      if (cfv) cfv.textContent = this.value;
    });
  }

  // Slider kecepatan
  const speedSlider = document.getElementById("speed-slider");
  if (speedSlider) {
    speedSlider.addEventListener("input", function () {
      simulationSpeed = parseInt(this.value);
      const sv = document.getElementById("speed-value");
      if (sv) sv.textContent = simulationSpeed;
      if (isSimulationRunning) {
        restartSimulation();
      }
    });
  }

  // Input referensi
  const refInput = document.getElementById("reference-input");
  if (refInput) {
    refInput.addEventListener("change", function () {
      const input = this.value
        .split(",")
        .map((num) => parseInt(num.trim()))
        .filter((num) => !isNaN(num));
      if (input.length > 0) {
        referenceString = input;
        resetSimulation();
        renderReferenceString();
      }
    });
  }

  // Tombol generate random
  const genBtn = document.getElementById("generate-random");
  if (genBtn) genBtn.addEventListener("click", generateRandomReference);
  const compGenBtn = document.getElementById("comparison-generate");
  if (compGenBtn) compGenBtn.addEventListener("click", generateComparisonReference);

  // Kontrol simulasi
  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.addEventListener("click", startSimulation);
  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetSimulation);
  const prevBtn = document.getElementById("prev-btn");
  if (prevBtn) prevBtn.addEventListener("click", previousStep);
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.addEventListener("click", nextStep);
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.addEventListener("click", pauseSimulation);

  // Perbandingan
  const runComp = document.getElementById("run-comparison");
  if (runComp) runComp.addEventListener("click", runAlgorithmComparison);

  // Hamburger menu
  const menuBtn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  const menuIcon = document.getElementById("mobile-menu-icon");
  const menuLinks = document.querySelectorAll(".mobile-menu-link");
  if (menuBtn && menu && menuIcon) {
    menuBtn.addEventListener("click", () => {
      menu.classList.toggle("hidden");
      if (menu.classList.contains("hidden")) {
        menuIcon.classList.remove("fa-times");
        menuIcon.classList.add("fa-bars");
      } else {
        menuIcon.classList.remove("fa-bars");
        menuIcon.classList.add("fa-times");
      }
    });
  }
  if (menuLinks)
    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (menu) menu.classList.add("hidden");
        if (menuIcon) {
          menuIcon.classList.remove("fa-times");
          menuIcon.classList.add("fa-bars");
        }
      });
    });

  // Detail algoritma toggles (cek ada)
  const fd = document.getElementById("fifo-detail-toggle");
  const ld = document.getElementById("lru-detail-toggle");
  const od = document.getElementById("optimal-detail-toggle");
  if (fd) fd.addEventListener("click", () => toggleAlgorithmDetail("fifo"));
  if (ld) ld.addEventListener("click", () => toggleAlgorithmDetail("lru"));
  if (od) od.addEventListener("click", () => toggleAlgorithmDetail("optimal"));

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

function initializeCharts() {
  // Chart.js defaults
  Chart.defaults.color = "#9ca3af";
  Chart.defaults.borderColor = "#374151";

  // Chart performa
  const performanceCanvas = document.getElementById("performance-chart");
  if (!performanceCanvas) return;
  const performanceCtx = performanceCanvas.getContext("2d");
  performanceChart = new Chart(performanceCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Hit Rate (Kumulatif)",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Fault Rate (Kumulatif)",
          data: [],
          borderColor: "#e11d48",
          backgroundColor: "rgba(225, 29, 72, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function (value) {
              return value + "%";
            },
          },
        },
      },
    },
  });

  // Chart perbandingan
  const compCanvas = document.getElementById("comparison-chart");
  if (!compCanvas) return;
  const comparisonCtx = compCanvas.getContext("2d");
  comparisonChart = new Chart(comparisonCtx, {
    type: "bar",
    data: {
      labels: ["FIFO", "LRU", "Optimal"],
      datasets: [
        {
          label: "Hit Rate (%)",
          data: [0, 0, 0],
          backgroundColor: "#10b981",
        },
        {
          label: "Page Fault",
          data: [0, 0, 0],
          backgroundColor: "#e11d48",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function setAlgorithm(algorithm) {
  currentAlgorithm = algorithm;

  // Update tampilan tombol (cek ada)
  document.querySelectorAll(".algorithm-btn").forEach((btn) => {
    btn.classList.remove("active", "bg-primary", "text-white", "border-primary");
    btn.classList.add("border-gray-600", "text-gray-300");
  });

  const btn = document.getElementById(`${algorithm}-btn`);
  if (btn) {
    btn.classList.add("active", "bg-primary", "text-white", "border-primary");
    btn.classList.remove("border-gray-600", "text-gray-300");
  }

  // Update nama algoritma (cek element)
  const algorithmNames = {
    fifo: "FIFO (First-In, First-Out)",
    lru: "LRU (Least Recently Used)",
    optimal: "Optimal",
  };
  const algNameEl = document.getElementById("algorithm-name");
  if (algNameEl) algNameEl.textContent = algorithmNames[algorithm] || algorithm;

  resetSimulation();
}

function setReferencePreset(preset) {
  referenceString = preset;
  const ri = document.getElementById("reference-input");
  if (ri) ri.value = preset.join(",");
  resetSimulation();
  renderReferenceString();
}

function generateRandomReference() {
  const length = Math.floor(Math.random() * 15) + 10;
  referenceString = Array.from({ length }, () => Math.floor(Math.random() * 8) + 1);
  const ri = document.getElementById("reference-input");
  if (ri) ri.value = referenceString.join(",");
  resetSimulation();
  renderReferenceString();
}

function generateComparisonReference() {
  const length = Math.floor(Math.random() * 15) + 10;
  const reference = Array.from({ length }, () => Math.floor(Math.random() * 8) + 1);
  const cri = document.getElementById("comparison-reference");
  if (cri) cri.value = reference.join(",");
}

function renderMemoryFrames() {
  const container = document.getElementById("memory-frames");
  if (!container) return;
  container.innerHTML = "";

  for (let i = 0; i < frameCount; i++) {
    const frame = document.createElement("div");
    frame.className = "page-frame";
    frame.id = `frame-${i}`;

    const frameIndex = document.createElement("div");
    frameIndex.className = "frame-index";
    frameIndex.textContent = i;

    const pageContent = document.createElement("div");
    pageContent.className = "page-content";
    pageContent.textContent = memoryFrames[i] || "-";

    frame.appendChild(frameIndex);
    frame.appendChild(pageContent);

    if (memoryFrames[i]) {
      frame.classList.add("filled");
    }

    // (Removed: dirty-bit/use-bit/clock-pointer rendering)

    container.appendChild(frame);
  }
}

function renderReferenceString() {
  const container = document.getElementById("reference-string");
  if (!container) return;
  container.innerHTML = "";

  referenceString.forEach((page, index) => {
    const pageElement = document.createElement("div");
    pageElement.className = "reference-page";
    pageElement.textContent = page;
    pageElement.id = `ref-${index}`;
    pageElement.setAttribute("data-index", index);

    if (index < currentStep) {
      pageElement.classList.add("processed");
      const stepData = timelineData[index];
      if (stepData) {
        if (stepData.hit) pageElement.classList.add("hit");
        else pageElement.classList.add("miss");
      }
    } else if (index === currentStep) {
      pageElement.classList.add("active");
    }

    pageElement.addEventListener("click", () => {
      if (!isSimulationRunning) goToStep(index);
    });

    container.appendChild(pageElement);
  });

  const sc = document.getElementById("step-counter");
  if (sc) sc.textContent = `${currentStep}/${referenceString.length}`;

  renderTimeline();
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
  if (!container) return;
  container.innerHTML = "";

  for (let step = 0; step < timelineData.length; step++) {
    const stepElement = document.createElement("div");
    stepElement.className = "timeline-step";

    const stepHeader = document.createElement("div");
    stepHeader.className = "text-xs font-bold mb-1";
    stepHeader.textContent = `S:${step + 1} (P:${referenceString[step]})`;

    const framesContainer = document.createElement("div");
    framesContainer.className = "timeline-frames";

    const stepData = timelineData[step];
    const frames = stepData.frames;

    for (let i = 0; i < frameCount; i++) {
      const frameElement = document.createElement("div");
      frameElement.className = "timeline-frame";
      frameElement.textContent = frames[i] || "";

      if (stepData.hitIndex === i) frameElement.classList.add("hit");
      else if (stepData.missIndex === i) {
        frameElement.classList.add("miss");
        if (stepData.replacedIndex === i) frameElement.classList.add("replaced");
      }

      framesContainer.appendChild(frameElement);
    }

    stepElement.appendChild(stepHeader);
    stepElement.appendChild(framesContainer);
    container.appendChild(stepElement);
  }

  container.scrollLeft = container.scrollWidth;
}

function startSimulation() {
  if (isSimulationRunning) {
    pauseSimulation();
    return;
  }

  if (currentStep >= referenceString.length) resetSimulation();

  isSimulationRunning = true;
  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.innerHTML = '<i class="fas fa-pause mr-2"></i> Jeda';
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-pause mr-2"></i>';
  const status = document.getElementById("status");
  if (status) status.textContent = "Berjalan";

  const interval = 1100 - simulationSpeed * 100;
  simulationInterval = setInterval(performStep, interval);
}

function pauseSimulation() {
  isSimulationRunning = false;
  clearInterval(simulationInterval);
  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.innerHTML = '<i class="fas fa-play mr-2"></i> Lanjutkan';
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-play mr-2"></i>';
  const status = document.getElementById("status");
  if (status) status.textContent = "Dijeda";
}

function restartSimulation() {
  if (isSimulationRunning) {
    pauseSimulation();
    startSimulation();
  }
}

function resetSimulation() {
  isSimulationRunning = false;
  clearInterval(simulationInterval);

  memoryFrames = Array(frameCount).fill(null);
  currentStep = 0;
  hitCount = 0;
  missCount = 0;
  timelineData = [];

  fifoQueue = [];
  lruQueue = [];

  // Reset state yang tersisa
  pageFrequencies = {}; // harmless, kept for compatibility (LFU removed)
  totalCost = 0;

  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.innerHTML = '<i class="fas fa-play mr-2"></i> Mulai Simulasi';
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-pause mr-2"></i>';
  const status = document.getElementById("status");
  if (status) status.textContent = "Siap";

  const logContainer = document.getElementById("simulation-log");
  if (logContainer)
    logContainer.innerHTML = '<p class="text-gray-500">Simulasi belum dimulai. Klik "Mulai Simulasi" untuk memulai.</p>';

  updateStatistics();
  renderMemoryFrames();
  renderReferenceString();
  renderQueueVisualization();

  // Atur visibilitas legenda clock jika ada element
  const legend = document.getElementById("clock-pointer-legend");
  if (legend) {
    if (currentAlgorithm === "clock") legend.classList.remove("hidden");
    else legend.classList.add("hidden");
  }

  // Tampilkan/ sembunyikan queue visualization
  const qv = document.getElementById("queue-visualization");
  if (qv) {
    if (currentAlgorithm === "fifo" || currentAlgorithm === "lru" || currentAlgorithm === "lfu")
      qv.classList.remove("hidden");
    else qv.classList.add("hidden");
  }

  if (performanceChart) {
    performanceChart.data.labels = [];
    performanceChart.data.datasets[0].data = [];
    performanceChart.data.datasets[1].data = [];
    performanceChart.update();
  }
}

function previousStep() {
  if (isSimulationRunning) pauseSimulation();

  if (currentStep > 0) {
    currentStep--;

    const prevData = timelineData[currentStep];
    if (prevData) {
      memoryFrames = [...prevData.previousFrames];
      hitCount = prevData.previousHitCount;
      missCount = prevData.previousMissCount;
      fifoQueue = [...prevData.previousFifoQueue];
      lruQueue = [...prevData.previousLruQueue];

      // restore other states (keamanan: fallback jika undefined)
      // previousUseBits/previousDirtyBits removed in saved timeline (clean)
      pageFrequencies = { ...(prevData.previousPageFrequencies || {}) };
      totalCost = prevData.previousTotalCost || 0;

      timelineData.pop();
    } else {
      resetSimulation();
      return;
    }

    updateVisualization();
    renderReferenceString();
    updateStatistics();
    updatePerformanceChart();
    renderQueueVisualization();
  }
}

function nextStep() {
  if (isSimulationRunning) pauseSimulation();

  if (currentStep < referenceString.length) performStep();
}

function goToStep(step) {
  if (isSimulationRunning) pauseSimulation();

  if (step >= 0 && step <= referenceString.length) {
    resetSimulation();
    while (currentStep < step) performStep(true); // silent
    updateVisualization();
    renderReferenceString();
    updateStatistics();
    updatePerformanceChart();
    renderQueueVisualization();
  }
}

function performStep(silent = false) {
  if (currentStep >= referenceString.length) {
    pauseSimulation();
    const status = document.getElementById("status");
    if (status) status.textContent = "Selesai";
    if (!silent) addLog("Simulasi selesai!", "text-primary font-bold");
    return;
  }

  const page = referenceString[currentStep];
  const isHit = memoryFrames.includes(page);
  // safe read write-toggle (may have been removed from HTML)
  const writeToggle = document.getElementById("write-toggle");
  const isWrite = writeToggle ? writeToggle.checked : false;

  // Simpan state sebelumnya untuk undo
  const previousFrames = [...memoryFrames];
  const previousHitCount = hitCount;
  const previousMissCount = missCount;
  const previousFifoQueue = [...fifoQueue];
  const previousLruQueue = [...lruQueue];
  const previousPageFrequencies = { ...(pageFrequencies || {}) };
  const previousTotalCost = totalCost || 0;

  let hit = isHit;
  let replacedPage = null;
  let replaceIndex = -1;
  let frameIndex = -1;

  if (hit) {
    // --- PAGE HIT ---
    hitCount++;
    frameIndex = memoryFrames.indexOf(page);
    if (!silent) {
      addLog(`Langkah ${currentStep + 1}: Page ${page} - HIT (frame ${frameIndex}) `, "text-success");
    }
    if (currentAlgorithm === "lru") {
      const lruPageIndex = lruQueue.indexOf(page);
      if (lruPageIndex > -1) lruQueue.splice(lruPageIndex, 1);
      lruQueue.push(page);
    }
  } else {
    // --- PAGE FAULT (MISS) ---
    missCount++;
    if (!silent) {
      addLog(`Langkah ${currentStep + 1}: Page ${page} - Page Fault (Read)`, "text-danger");
    }

    const emptyIndex = memoryFrames.indexOf(null);

    if (emptyIndex !== -1) {
      // Ada frame kosong
      memoryFrames[emptyIndex] = page;
      frameIndex = emptyIndex;

      if (currentAlgorithm === "fifo") fifoQueue.push(page);
      if (currentAlgorithm === "lru") lruQueue.push(page);

      if (!silent) {
        addLog(`Page ${page} dimasukkan ke frame ${frameIndex} (kosong)`);
      }
    } else {
      // Tidak ada frame kosong, lakukan page replacement
      replaceIndex = getReplacementIndex();
      replacedPage = memoryFrames[replaceIndex];

      memoryFrames[replaceIndex] = page;
      frameIndex = replaceIndex;

      if (currentAlgorithm === "fifo") {
        const victimInQueueIndex = fifoQueue.indexOf(replacedPage);
        if (victimInQueueIndex > -1) fifoQueue.splice(victimInQueueIndex, 1);
        fifoQueue.push(page);
      }
      if (currentAlgorithm === "lru") {
        const victimInQueueIndex = lruQueue.indexOf(replacedPage);
        if (victimInQueueIndex > -1) lruQueue.splice(victimInQueueIndex, 1);
        lruQueue.push(page);
      }

      if (!silent) {
        addLog(`Page ${replacedPage} di frame ${replaceIndex} diganti oleh page ${page} (${currentAlgorithm.toUpperCase()})`, "text-warning");
      }
    }
  }

  // Simpan data timeline (simplified, no dirty/use bits)
  timelineData[currentStep] = {
    frames: [...memoryFrames],
    hit: hit,
    hitIndex: hit ? frameIndex : -1,
    missIndex: !hit ? frameIndex : -1,
    replacedIndex: replaceIndex,
    previousFrames: previousFrames,
    previousHitCount: previousHitCount,
    previousMissCount: previousMissCount,
    previousFifoQueue: previousFifoQueue,
    previousLruQueue: previousLruQueue,
    previousPageFrequencies: previousPageFrequencies,
    previousTotalCost: previousTotalCost,
  };

  // Update visualisasi
  if (!silent) updateVisualization(page, hit, frameIndex, replaceIndex);

  currentStep++;

  if (!silent) {
    renderReferenceString();
    updateStatistics();
    updatePerformanceChart();
    renderQueueVisualization();
  }

  if (currentStep >= referenceString.length && !silent) {
    pauseSimulation();
    const status = document.getElementById("status");
    if (status) status.textContent = "Selesai";
    addLog("Simulasi selesai!", "text-primary font-bold");
  }
}

function getReplacementIndex() {
  switch (currentAlgorithm) {
    case "fifo": {
      const fifoVictim = fifoQueue[0];
      return memoryFrames.indexOf(fifoVictim);
    }
    case "lru": {
      const lruVictim = lruQueue[0];
      return memoryFrames.indexOf(lruVictim);
    }
    case "optimal": {
      let farthestUse = -1;
      let replaceIndex = 0;
      for (let i = 0; i < frameCount; i++) {
        const page = memoryFrames[i];
        let nextUse = referenceString.slice(currentStep + 1).indexOf(page);
        if (nextUse === -1) return i;
        if (nextUse > farthestUse) {
          farthestUse = nextUse;
          replaceIndex = i;
        }
      }
      return replaceIndex;
    }
    default:
      // fallback: ganti frame ke-0
      return 0;
  }
}

function updateVisualization(page = null, isHit = null, frameIndex = -1, replacedIndex = -1) {
  document.querySelectorAll(".page-frame").forEach((frame) => {
    frame.classList.remove("active", "hit", "miss", "replaced", "clock-pointer");
  });

  if (page !== null && frameIndex !== -1) {
    const frameElement = document.getElementById(`frame-${frameIndex}`);
    if (frameElement) {
      frameElement.classList.add("active");
      if (isHit) frameElement.classList.add("hit");
      else {
        frameElement.classList.add("miss");
        if (replacedIndex !== -1) frameElement.classList.add("replaced");
      }
    }
  }

  renderMemoryFrames();
}

function updateStatistics() {
  const hc = document.getElementById("hit-count");
  const mc = document.getElementById("miss-count");
  const hr = document.getElementById("hit-rate");
  if (hc) hc.textContent = hitCount;
  if (mc) mc.textContent = missCount;

  const total = hitCount + missCount;
  const hitRate = total > 0 ? Math.round((hitCount / total) * 100) : 0;
  if (hr) hr.textContent = `${hitRate}%`;

  const ph = document.getElementById("performance-hit");
  const pm = document.getElementById("performance-miss");
  if (ph) ph.style.width = `${hitRate}%`;
  if (pm) pm.style.width = `${total > 0 ? 100 - hitRate : 0}%`;

  const pht = document.getElementById("performance-hit-text");
  const pmt = document.getElementById("performance-miss-text");
  if (pht) pht.textContent = `${hitRate}%`;
  if (pmt) pmt.textContent = `${total > 0 ? 100 - hitRate : 0}%`;
}

function calculateOptimalHitRate() {
  let optimalHits = 0;
  let optimalFrames = Array(frameCount).fill(null);
  for (let i = 0; i < referenceString.length; i++) {
    const page = referenceString[i];
    if (optimalFrames.includes(page)) {
      optimalHits++;
    } else {
      const emptyIndex = optimalFrames.indexOf(null);
      if (emptyIndex !== -1) optimalFrames[emptyIndex] = page;
      else {
        let farthestUse = -1;
        let replaceIndex = 0;
        for (let j = 0; j < frameCount; j++) {
          const framePage = optimalFrames[j];
          let nextUse = referenceString.slice(i + 1).indexOf(framePage);
          if (nextUse === -1) {
            replaceIndex = j;
            break;
          }
          if (nextUse > farthestUse) {
            farthestUse = nextUse;
            replaceIndex = j;
          }
        }
        optimalFrames[replaceIndex] = page;
      }
    }
  }
  const total = referenceString.length;
  return total > 0 ? Math.round((optimalHits / total) * 100) : 0;
}

function updatePerformanceChart() {
  if (!performanceChart || timelineData.length === 0) return;

  const labels = [];
  const hitRates = [];
  const faultRates = [];
  let currentHits = 0;
  let currentMisses = 0;

  for (let i = 0; i < timelineData.length; i++) {
    labels.push(i + 1);
    const data = timelineData[i];
    if (data.hit) currentHits++;
    else currentMisses++;

    const total = currentHits + currentMisses;
    const currentHitRate = total > 0 ? Math.round((currentHits / total) * 100) : 0;
    const currentFaultRate = total > 0 ? Math.round((currentMisses / total) * 100) : 0;

    hitRates.push(currentHitRate);
    faultRates.push(currentFaultRate);
  }

  performanceChart.data.labels = labels;
  performanceChart.data.datasets[0].data = hitRates;
  performanceChart.data.datasets[1].data = faultRates;
  performanceChart.update();
}

function runAlgorithmComparison() {
  const referenceInput = document.getElementById("comparison-reference");
  if (!referenceInput) {
    alert("Tidak menemukan input perbandingan!");
    return;
  }
  const comparisonReference = referenceInput.value
    .split(",")
    .map((num) => parseInt(num.trim()))
    .filter((num) => !isNaN(num));
  const comparisonFrameCount = parseInt(document.getElementById("comparison-frame-slider").value || frameCount);

  if (comparisonReference.length === 0) {
    alert("Masukkan string referensi yang valid!");
    return;
  }

  const compareBtn = document.getElementById("run-comparison");
  if (compareBtn) {
    compareBtn.disabled = true;
    compareBtn.classList.add("loading-btn");
  }

  const originalAlgorithm = currentAlgorithm;
  const originalReference = [...referenceString];
  const originalFrameCount = frameCount;

  setTimeout(() => {
    const algorithms = ["fifo", "lru", "optimal"];
    const hitRates = [];
    const faultCounts = [];

    algorithms.forEach((algorithm) => {
      currentAlgorithm = algorithm;
      referenceString = [...comparisonReference];
      frameCount = comparisonFrameCount;

      resetSimulation();

      // ensure no error if write-toggle removed
      const writeToggle = document.getElementById("write-toggle");
      if (writeToggle) writeToggle.checked = false;

      while (currentStep < referenceString.length) performStep(true); // silent

      const total = hitCount + missCount;
      const hitRate = total > 0 ? Math.round((hitCount / total) * 100) : 0;
      hitRates.push(hitRate);
      faultCounts.push(missCount);

      algorithmStats[algorithm].hits = hitCount;
      algorithmStats[algorithm].misses = missCount;
    });

    // Kembalikan state awal
    setAlgorithm(originalAlgorithm);
    referenceString = [...originalReference];
    frameCount = originalFrameCount;
    const ri = document.getElementById("reference-input");
    if (ri) ri.value = referenceString.join(",");
    const fs = document.getElementById("frame-slider");
    if (fs) fs.value = frameCount;
    const fv = document.getElementById("frame-value");
    if (fv) fv.textContent = frameCount;
    resetSimulation();
    renderReferenceString();

    if (comparisonChart) {
      comparisonChart.data.labels = ["FIFO", "LRU", "Optimal"];
      comparisonChart.data.datasets[0].data = hitRates;
      comparisonChart.data.datasets[1].data = faultCounts;
      comparisonChart.update();
    }

    addLog("Perbandingan selesai!", "text-primary font-bold");

    if (compareBtn) {
      compareBtn.disabled = false;
      compareBtn.classList.remove("loading-btn");
    }
  }, 50);
}

function renderQueueVisualization() {
  const container = document.getElementById("queue-container");
  const visualizer = document.getElementById("queue-visualization");
  const algoNameEl = document.getElementById("queue-algo-name");
  if (!container || !visualizer || !algoNameEl) return;
  container.innerHTML = "";

  let queue = [];
  if (currentAlgorithm === "fifo") {
    queue = fifoQueue;
    algoNameEl.textContent = "FIFO";
    visualizer.classList.remove("hidden");
  } else if (currentAlgorithm === "lru") {
    queue = lruQueue;
    algoNameEl.textContent = "LRU";
    visualizer.classList.remove("hidden");
  } else {
    visualizer.classList.add("hidden");
    return;
  }

  if (queue.length === 0) {
    container.innerHTML = '<span class="text-gray-500 italic">Antrian kosong</span>';
    return;
  }

  queue.forEach((page, index) => {
    const pageElement = document.createElement("div");
    pageElement.className = "queue-page";
    pageElement.textContent = page;

    const labelElement = document.createElement("div");
    labelElement.className = "queue-label";

    if (index === 0) labelElement.textContent = currentAlgorithm === "lru" ? "TERLAMA" : "DEPAN";
    if (index === queue.length - 1) labelElement.textContent = currentAlgorithm === "lru" ? "TERBARU" : "BELAKANG";

    const wrapper = document.createElement("div");
    wrapper.appendChild(pageElement);
    wrapper.appendChild(labelElement);
    container.appendChild(wrapper);
  });
}

function toggleAlgorithmDetail(algorithm) {
  const detailElement = document.getElementById(`${algorithm}-detail`);
  const toggleIcon = document.getElementById(`${algorithm}-detail-toggle`)?.querySelector("i");
  if (!detailElement || !toggleIcon) return;

  if (detailElement.classList.contains("open")) {
    detailElement.classList.remove("open");
    toggleIcon.classList.remove("fa-chevron-up");
    toggleIcon.classList.add("fa-chevron-down");
    toggleIcon.classList.remove("rotate-180");
  } else {
    document.querySelectorAll(".algorithm-details").forEach((el) => el.classList.remove("open"));
    document.querySelectorAll(".fa-chevron-up").forEach((icon) => {
      icon.classList.remove("fa-chevron-up");
      icon.classList.add("fa-chevron-down");
      icon.classList.remove("rotate-180");
    });

    detailElement.classList.add("open");
    toggleIcon.classList.remove("fa-chevron-down");
    toggleIcon.classList.add("fa-chevron-up");
    toggleIcon.classList.add("rotate-180");
  }
}

function addLog(message, className = "text-gray-300") {
  const logContainer = document.getElementById("simulation-log");
  if (!logContainer) return;

  const defaultMessage = logContainer.querySelector(".text-gray-500");
  if (defaultMessage) defaultMessage.remove();

  const logEntry = document.createElement("p");
  logEntry.className = `${className} mb-1`;
  logEntry.textContent = message;

  logContainer.appendChild(logEntry);
  while (logContainer.children.length > 100) logContainer.removeChild(logContainer.firstChild);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Tutup menu saat link diklik (safety)
document.querySelectorAll(".mobile-menu-link").forEach((link) => {
  link.addEventListener("click", () => {
    const mm = document.getElementById("mobile-menu");
    const mi = document.getElementById("mobile-menu-icon");
    if (mm) mm.classList.add("hidden");
    if (mi) {
      mi.classList.remove("fa-xmark");
      mi.classList.add("fa-bars");
    }
  });
});
