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

// --- PENGEMBANGAN BARU (LFU, Clock, Cost) ---
let useBits = []; // R-Bit (Referenced)
let dirtyBits = []; // M-Bit (Modified)
let clockPointer = 0;

// Konstanta Biaya (BARU)
const MEMORY_ACCESS_COST = 1; // Biaya akses RAM (Hit)
const DISK_READ_COST = 100; // Biaya baca dari disk (Miss)
const DISK_WRITE_COST = 200; // Biaya tulis ke disk (Dirty page replacement)
// ---------------------------------------------

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
  // Set nilai awal
  document.getElementById("frame-value").textContent = frameCount;
  document.getElementById("comparison-frame-value").textContent = frameCount;
  document.getElementById("reference-input").value = referenceString.join(",");
  document.getElementById("comparison-reference").value =
    referenceString.join(",");
  document.getElementById("speed-value").textContent = simulationSpeed;

  // Set algoritma aktif
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
    { threshold: 0.3 } // 50% bagian section terlihat baru dianggap aktif
  );

  // Daftarkan semua section
  sections.forEach((section) => observer.observe(section));

  // Tombol algoritma
  document
    .getElementById("fifo-btn")
    .addEventListener("click", () => setAlgorithm("fifo"));
  document
    .getElementById("lru-btn")
    .addEventListener("click", () => setAlgorithm("lru"));
  document
    .getElementById("optimal-btn")
    .addEventListener("click", () => setAlgorithm("optimal"));

  // Slider frame
  document
    .getElementById("frame-slider")
    .addEventListener("input", function () {
      frameCount = parseInt(this.value);
      document.getElementById("frame-value").textContent = frameCount;
      resetSimulation();
      renderMemoryFrames();
    });

  document
    .getElementById("comparison-frame-slider")
    .addEventListener("input", function () {
      document.getElementById("comparison-frame-value").textContent =
        this.value;
    });

  // Slider kecepatan
  document
    .getElementById("speed-slider")
    .addEventListener("input", function () {
      simulationSpeed = parseInt(this.value);
      document.getElementById("speed-value").textContent = simulationSpeed;
      if (isSimulationRunning) {
        restartSimulation();
      }
    });

  // Input referensi
  document
    .getElementById("reference-input")
    .addEventListener("change", function () {
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

  // Tombol generate random
  document
    .getElementById("generate-random")
    .addEventListener("click", generateRandomReference);
  document
    .getElementById("comparison-generate")
    .addEventListener("click", generateComparisonReference);

  // Kontrol simulasi
  document
    .getElementById("start-btn")
    .addEventListener("click", startSimulation);
  document
    .getElementById("reset-btn")
    .addEventListener("click", resetSimulation);
  document.getElementById("prev-btn").addEventListener("click", previousStep);
  document.getElementById("next-btn").addEventListener("click", nextStep);
  document
    .getElementById("pause-btn")
    .addEventListener("click", pauseSimulation);

  // Perbandingan
  document
    .getElementById("run-comparison")
    .addEventListener("click", runAlgorithmComparison);

  // --- BARU: Event Listener untuk Hamburger Menu ---
  const menuBtn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  const menuIcon = document.getElementById("mobile-menu-icon");
  const menuLinks = document.querySelectorAll(".mobile-menu-link");

  menuBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
    if (menu.classList.contains("hidden")) {
      // Menu tertutup
      menuIcon.classList.remove("fa-times");
      menuIcon.classList.add("fa-bars");
    } else {
      // Menu terbuka
      menuIcon.classList.remove("fa-bars");
      menuIcon.classList.add("fa-times");
    }
  });

  // Menutup menu saat link di-klik
  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.add("hidden");
      menuIcon.classList.remove("fa-times");
      menuIcon.classList.add("fa-bars");
    });
  });
  // --- Akhir dari listener hamburger ---

  // Detail algoritma
  document
    .getElementById("fifo-detail-toggle")
    .addEventListener("click", () => toggleAlgorithmDetail("fifo"));
  document
    .getElementById("lru-detail-toggle")
    .addEventListener("click", () => toggleAlgorithmDetail("lru"));
  document
    .getElementById("optimal-detail-toggle")
    .addEventListener("click", () => toggleAlgorithmDetail("optimal"));

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
  // Chart.js defaults untuk dark mode baru
  Chart.defaults.color = "#9ca3af"; // gray-400
  Chart.defaults.borderColor = "#374151"; // gray-700

  // Chart performa
  const performanceCtx = document
    .getElementById("performance-chart")
    .getContext("2d");
  performanceChart = new Chart(performanceCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Hit Rate (Kumulatif)",
          data: [],
          borderColor: "#10b981", // success
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Fault Rate (Kumulatif)",
          data: [],
          borderColor: "#e11d48", // danger
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
  const comparisonCtx = document
    .getElementById("comparison-chart")
    .getContext("2d");
  comparisonChart = new Chart(comparisonCtx, {
    type: "bar",
    data: {
      labels: ["FIFO", "LRU", "Optimal"],
      datasets: [
        {
          label: "Hit Rate (%)",
          data: [0, 0, 0],
          backgroundColor: "#10b981", // success
        },
        {
          label: "Page Fault",
          data: [0, 0, 0],
          backgroundColor: "#e11d48", // danger
        },
        // TODO: Tambahkan dataset untuk Total Cost
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

  // Update tampilan tombol
  document.querySelectorAll(".algorithm-btn").forEach((btn) => {
    btn.classList.remove(
      "active",
      "bg-primary",
      "text-white",
      "border-primary"
    );
    btn.classList.add("border-gray-600", "text-gray-300");
  });

  document
    .getElementById(`${algorithm}-btn`)
    .classList.add("active", "bg-primary", "text-white", "border-primary");
  document
    .getElementById(`${algorithm}-btn`)
    .classList.remove("border-gray-600", "text-gray-300");

  // Update nama algoritma
  const algorithmNames = {
    fifo: "FIFO (First-In, First-Out)",
    lru: "LRU (Least Recently Used)",
    optimal: "Optimal",
  };
  document.getElementById("algorithm-name").textContent =
    algorithmNames[algorithm];

  resetSimulation();
}

function setReferencePreset(preset) {
  referenceString = preset;
  document.getElementById("reference-input").value = preset.join(",");
  resetSimulation();
  renderReferenceString();
}

function generateRandomReference() {
  const length = Math.floor(Math.random() * 15) + 10;
  referenceString = Array.from(
    { length },
    () => Math.floor(Math.random() * 8) + 1
  );

  document.getElementById("reference-input").value = referenceString.join(",");
  resetSimulation();
  renderReferenceString();
}

function generateComparisonReference() {
  const length = Math.floor(Math.random() * 15) + 10;
  const reference = Array.from(
    { length },
    () => Math.floor(Math.random() * 8) + 1
  );

  document.getElementById("comparison-reference").value = reference.join(",");
}

function renderMemoryFrames() {
  const container = document.getElementById("memory-frames");
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

    // Visualisasi Bit
    if (memoryFrames[i]) {
      // Tampilkan M-Bit (Dirty)
      if (dirtyBits[i] === 1) {
        const dirtyBitElement = document.createElement("div");
        dirtyBitElement.className = "dirty-bit";
        dirtyBitElement.textContent = "M";
        frame.appendChild(dirtyBitElement);
      }

      // Tampilkan R-Bit (Use) - hanya untuk Clock
      if (currentAlgorithm === "clock") {
        const useBitElement = document.createElement("div");
        useBitElement.className = "use-bit";
        useBitElement.textContent = useBits[i];
        frame.appendChild(useBitElement);
      }
    }

    // Visualisasi Pointer Clock
    if (currentAlgorithm === "clock") {
      if (i === clockPointer) {
        frame.classList.add("clock-pointer");
      }
    }

    container.appendChild(frame);
  }
}

function renderReferenceString() {
  const container = document.getElementById("reference-string");
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
        if (stepData.hit) {
          pageElement.classList.add("hit");
        } else {
          pageElement.classList.add("miss");
        }
      }
    } else if (index === currentStep) {
      pageElement.classList.add("active");
    }

    pageElement.addEventListener("click", () => {
      if (!isSimulationRunning) {
        goToStep(index);
      }
    });

    container.appendChild(pageElement);
  });

  document.getElementById(
    "step-counter"
  ).textContent = `${currentStep}/${referenceString.length}`;
  renderTimeline();
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
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

      if (stepData.hitIndex === i) {
        frameElement.classList.add("hit");
      } else if (stepData.missIndex === i) {
        frameElement.classList.add("miss");
        if (stepData.replacedIndex === i) {
          frameElement.classList.add("replaced");
        }
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

  if (currentStep >= referenceString.length) {
    resetSimulation();
  }

  isSimulationRunning = true;
  document.getElementById("start-btn").innerHTML =
    '<i class="fas fa-pause mr-2"></i> Jeda';
  document.getElementById("pause-btn").innerHTML =
    '<i class="fas fa-pause mr-2"></i>';
  document.getElementById("status").textContent = "Berjalan";

  const interval = 1100 - simulationSpeed * 100;
  simulationInterval = setInterval(performStep, interval);
}

function pauseSimulation() {
  isSimulationRunning = false;
  clearInterval(simulationInterval);
  document.getElementById("start-btn").innerHTML =
    '<i class="fas fa-play mr-2"></i> Lanjutkan';
  document.getElementById("pause-btn").innerHTML =
    '<i class="fas fa-play mr-2"></i>';
  document.getElementById("status").textContent = "Dijeda";
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

  // Reset variabel baru
  useBits = Array(frameCount).fill(0);
  dirtyBits = Array(frameCount).fill(0);
  clockPointer = 0;
  pageFrequencies = {};
  totalCost = 0; // Reset biaya

  document.getElementById("start-btn").innerHTML =
    '<i class="fas fa-play mr-2"></i> Mulai Simulasi';
  document.getElementById("pause-btn").innerHTML =
    '<i class="fas fa-pause mr-2"></i>';
  document.getElementById("status").textContent = "Siap";

  const logContainer = document.getElementById("simulation-log");
  logContainer.innerHTML =
    '<p class="text-gray-500">Simulasi belum dimulai. Klik "Mulai Simulasi" untuk memulai.</p>';

  updateStatistics();
  renderMemoryFrames();
  renderReferenceString();
  renderQueueVisualization();

  // Atur visibilitas legenda & visualisasi antrian
  if (currentAlgorithm === "clock") {
    document.getElementById("clock-pointer-legend").classList.remove("hidden");
  } else {
    document.getElementById("clock-pointer-legend").classList.add("hidden");
  }

  // LFU sekarang juga menggunakan FIFO queue untuk tie-breaking, jadi tampilkan
  if (
    currentAlgorithm === "fifo" ||
    currentAlgorithm === "lru" ||
    currentAlgorithm === "lfu"
  ) {
    document.getElementById("queue-visualization").classList.remove("hidden");
  } else {
    document.getElementById("queue-visualization").classList.add("hidden");
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

      // Restore state baru
      useBits = [...prevData.previousUseBits];
      dirtyBits = [...prevData.previousDirtyBits];
      pageFrequencies = { ...prevData.previousPageFrequencies };
      clockPointer = prevData.previousClockPointer;
      totalCost = prevData.previousTotalCost; // Restore biaya

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

  if (currentStep < referenceString.length) {
    performStep();
  }
}

function goToStep(step) {
  if (isSimulationRunning) pauseSimulation();

  if (step >= 0 && step <= referenceString.length) {
    resetSimulation();
    while (currentStep < step) {
      performStep(true); // Silent mode
    }

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
    document.getElementById("status").textContent = "Selesai";
    if (!silent) addLog("Simulasi selesai!", "text-primary font-bold");
    return;
  }

  const page = referenceString[currentStep];
  const isHit = memoryFrames.includes(page);
  const isWrite = document.getElementById("write-toggle").checked;

  // Simpan state sebelumnya untuk undo
  const previousFrames = [...memoryFrames];
  const previousHitCount = hitCount;
  const previousMissCount = missCount;
  const previousFifoQueue = [...fifoQueue];
  const previousLruQueue = [...lruQueue];
  const previousUseBits = [...useBits];
  const previousDirtyBits = [...dirtyBits];
  const previousPageFrequencies = { ...pageFrequencies };
  const previousClockPointer = clockPointer;
  const previousTotalCost = totalCost; // Simpan biaya

  let hit = isHit;
  let replacedPage = null;
  let replaceIndex = -1;
  let frameIndex = -1;

  if (hit) {
    // --- PAGE HIT ---
    hitCount++;
    totalCost += MEMORY_ACCESS_COST; // Tambah biaya HIT
    frameIndex = memoryFrames.indexOf(page);
    if (!silent) {
      addLog(
        `Langkah ${
          currentStep + 1
        }: Page ${page} - HIT (frame ${frameIndex}) `,
        "text-success"
      );
    }

    if (currentAlgorithm === "lru") {
      const lruPageIndex = lruQueue.indexOf(page);
      if (lruPageIndex > -1) lruQueue.splice(lruPageIndex, 1);
      lruQueue.push(page);
    }
    if (currentAlgorithm === "lfu") {
      pageFrequencies[page]++;
    }
    if (currentAlgorithm === "clock") {
      useBits[frameIndex] = 1;
      if (!silent)
        addLog(
          `Use bit (R) untuk frame ${frameIndex} (Page ${page}) diatur ke 1`
        );
    }
    if (isWrite) {
      if (dirtyBits[frameIndex] === 0) {
        // Hanya log jika berubah
        dirtyBits[frameIndex] = 1;
        if (!silent)
          addLog(
            `Dirty bit (M) untuk frame ${frameIndex} (Page ${page}) diatur ke 1 (WRITE)`,
            "text-danger"
          );
      }
    }
  } else {
    // --- PAGE FAULT (MISS) ---
    missCount++;
    totalCost += DISK_READ_COST; // Tambah biaya MISS (selalu baca dari disk)

    if (!silent) {
      addLog(
        `Langkah ${
          currentStep + 1
        }: Page ${page} - Page Fault (Read)`,
        "text-danger"
      );
    }

    const emptyIndex = memoryFrames.indexOf(null);

    if (emptyIndex !== -1) {
      // Ada frame kosong
      memoryFrames[emptyIndex] = page;
      frameIndex = emptyIndex;

      if (currentAlgorithm === "fifo" || currentAlgorithm === "lfu")
        fifoQueue.push(page);
      if (currentAlgorithm === "lru") lruQueue.push(page);
      if (currentAlgorithm === "lfu") {
        if (!pageFrequencies[page]) pageFrequencies[page] = 0;
        pageFrequencies[page]++;
      }
      if (currentAlgorithm === "clock") {
        useBits[frameIndex] = 0;
      }

      dirtyBits[frameIndex] = isWrite ? 1 : 0; // Set M-Bit

      if (!silent) {
        addLog(`Page ${page} dimasukkan ke frame ${frameIndex} (kosong)`);
        if (isWrite)
          addLog(
            `Dirty bit (M) untuk frame ${frameIndex} diatur ke 1 (WRITE)`,
            "text-danger"
          );
      }
    } else {
      // Tidak ada frame kosong, lakukan page replacement
      replaceIndex = getReplacementIndex();
      replacedPage = memoryFrames[replaceIndex];

      // --- PENGECEKAN BIAYA WRITE (BARU) ---
      if (dirtyBits[replaceIndex] === 1) {
        totalCost += DISK_WRITE_COST;
        if (!silent)
          addLog(
            `Biaya Tambahan: Page ${replacedPage} "kotor" (M=1). Cost: +${DISK_WRITE_COST} (Write)`,
            "text-accent"
          );
      }
      // ---

      memoryFrames[replaceIndex] = page;
      frameIndex = replaceIndex;

      if (currentAlgorithm === "fifo" || currentAlgorithm === "lfu") {
        const victimInQueueIndex = fifoQueue.indexOf(replacedPage);
        if (victimInQueueIndex > -1) fifoQueue.splice(victimInQueueIndex, 1);
        fifoQueue.push(page);
      }
      if (currentAlgorithm === "lru") {
        const victimInQueueIndex = lruQueue.indexOf(replacedPage);
        if (victimInQueueIndex > -1) lruQueue.splice(victimInQueueIndex, 1);
        lruQueue.push(page);
      }
      if (currentAlgorithm === "lfu") {
        if (!pageFrequencies[page]) pageFrequencies[page] = 0;
        pageFrequencies[page]++;
      }
      if (currentAlgorithm === "clock") {
        useBits[frameIndex] = 0;
      }

      dirtyBits[frameIndex] = isWrite ? 1 : 0; // Set M-Bit untuk halaman baru

      if (!silent) {
        addLog(
          `Page ${replacedPage} di frame ${replaceIndex} diganti oleh page ${page} (${currentAlgorithm.toUpperCase()})`,
          "text-warning"
        );
        if (isWrite)
          addLog(
            `Dirty bit (M) untuk frame ${frameIndex} diatur ke 1 (WRITE)`,
            "text-danger"
          );
      }
    }
  }

  // Simpan data timeline
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
    previousUseBits: previousUseBits,
    previousDirtyBits: previousDirtyBits,
    previousPageFrequencies: previousPageFrequencies,
    previousClockPointer: previousClockPointer,
    previousTotalCost: previousTotalCost, // Simpan biaya
  };

  // Update visualisasi
  if (!silent) {
    updateVisualization(page, hit, frameIndex, replaceIndex);
  }

  currentStep++;

  if (!silent) {
    renderReferenceString();
    updateStatistics();
    updatePerformanceChart();
    renderQueueVisualization();
  }

  if (currentStep >= referenceString.length && !silent) {
    pauseSimulation();
    document.getElementById("status").textContent = "Selesai";
    addLog("Simulasi selesai!", "text-primary font-bold");
  }
}

function getReplacementIndex() {
  switch (currentAlgorithm) {
    case "fifo":
      const fifoVictim = fifoQueue[0];
      return memoryFrames.indexOf(fifoVictim);

    case "lru":
      const lruVictim = lruQueue[0];
      return memoryFrames.indexOf(lruVictim);

    case "lfu":
      return lfuReplacement();

    case "clock":
      return clockReplacement();

    case "optimal":
      let farthestUse = -1;
      let replaceIndex = 0;

      for (let i = 0; i < frameCount; i++) {
        const page = memoryFrames[i];
        let nextUse = referenceString.slice(currentStep + 1).indexOf(page);

        if (nextUse === -1) {
          return i;
        }

        if (nextUse > farthestUse) {
          farthestUse = nextUse;
          replaceIndex = i;
        }
      }
      return replaceIndex;

    case "random":
      return Math.floor(Math.random() * frameCount);

    default:
      return 0;
  }
}

function lfuReplacement() {
  let victimIndex = -1;
  let minFrequency = Infinity;

  let candidates = [];
  for (let i = 0; i < frameCount; i++) {
    const page = memoryFrames[i];
    const freq = pageFrequencies[page] || 0;

    if (freq < minFrequency) {
      minFrequency = freq;
      candidates = [i];
    } else if (freq === minFrequency) {
      candidates.push(i);
    }
  }

  if (candidates.length === 1) {
    victimIndex = candidates[0];
  } else {
    for (const pageInFifo of fifoQueue) {
      const indexInFrames = memoryFrames.indexOf(pageInFifo);
      if (candidates.includes(indexInFrames)) {
        victimIndex = indexInFrames;
        break;
      }
    }
  }

  if (victimIndex === -1) {
    victimIndex = candidates[0];
  }

  if (victimIndex != -1)
    addLog(
      `LFU: Korban frame ${victimIndex} (Page ${memoryFrames[victimIndex]}) - Freq: ${minFrequency}`,
      "text-yellow-400"
    );
  return victimIndex;
}

function clockReplacement() {
  let pass = 1;
  let initialPointer = clockPointer;
  let passesCompleted = 0;

  while (true) {
    const rBit = useBits[clockPointer];
    const mBit = dirtyBits[clockPointer];

    // Pass 1: Cari (R=0, M=0)
    if (pass === 1) {
      if (rBit === 0 && mBit === 0) {
        addLog(
          `Clock (Pass 1): Pointer di frame ${clockPointer}. (R=0, M=0). Mengganti Page ${memoryFrames[clockPointer]}.`,
          "text-yellow-400"
        );
        const victimIndex = clockPointer;
        clockPointer = (clockPointer + 1) % frameCount;
        return victimIndex;
      }
    }

    // Pass 2: Cari (R=0, M=1), set R=0 saat scan
    else if (pass === 2) {
      if (rBit === 0 && mBit === 1) {
        addLog(
          `Clock (Pass 2): Pointer di frame ${clockPointer}. (R=0, M=1). Mengganti Page ${memoryFrames[clockPointer]}.`,
          "text-yellow-400"
        );
        const victimIndex = clockPointer;
        clockPointer = (clockPointer + 1) % frameCount;
        return victimIndex;
      }
      if (rBit === 1) {
        // addLog(`Clock (Pass 2): Pointer di frame ${clockPointer} (R=1). Set R=0.`);
        useBits[clockPointer] = 0;
      }
    }

    clockPointer = (clockPointer + 1) % frameCount;

    if (clockPointer === initialPointer) {
      passesCompleted++;
      if (pass === 1) {
        pass = 2;
        addLog(
          `Clock: Selesai Pass 1. Memulai Pass 2 (Cari R=0, M=1 & set R=0)`
        );
      } else {
        pass = 1;
        addLog(`Clock: Selesai Pass 2. Memulai Pass 1 (Cari R=0, M=0)`);
      }

      if (passesCompleted > 4) {
        addLog(
          `Clock: Safety break! Mengganti frame ${clockPointer}`,
          "text-red-500"
        );
        return clockPointer;
      }
    }
  }
}

function updateVisualization(
  page = null,
  isHit = null,
  frameIndex = -1,
  replacedIndex = -1
) {
  document.querySelectorAll(".page-frame").forEach((frame) => {
    frame.classList.remove(
      "active",
      "hit",
      "miss",
      "replaced",
      "clock-pointer"
    );
  });

  if (page !== null && frameIndex !== -1) {
    const frameElement = document.getElementById(`frame-${frameIndex}`);
    frameElement.classList.add("active");

    if (isHit) {
      frameElement.classList.add("hit");
    } else {
      frameElement.classList.add("miss");
      if (replacedIndex !== -1) {
        frameElement.classList.add("replaced");
      }
    }
  }

  renderMemoryFrames();
}

function updateStatistics() {
  document.getElementById("hit-count").textContent = hitCount;
  document.getElementById("miss-count").textContent = missCount;

  const total = hitCount + missCount;
  const hitRate = total > 0 ? Math.round((hitCount / total) * 100) : 0;
  document.getElementById("hit-rate").textContent = `${hitRate}%`;

  document.getElementById("performance-hit").style.width = `${hitRate}%`;
  document.getElementById("performance-miss").style.width = `${
    total > 0 ? 100 - hitRate : 0
  }%`;
  document.getElementById("performance-hit-text").textContent = `${hitRate}%`;
  document.getElementById("performance-miss-text").textContent = `${
    total > 0 ? 100 - hitRate : 0
  }%`;
}

function calculateOptimalHitRate() {
  // Fungsi ini hanya digunakan untuk perbandingan,
  // tapi kita tetap simpan untuk analisis jika diperlukan
  let optimalHits = 0;
  let optimalFrames = Array(frameCount).fill(null);

  for (let i = 0; i < referenceString.length; i++) {
    const page = referenceString[i];

    if (optimalFrames.includes(page)) {
      optimalHits++;
    } else {
      const emptyIndex = optimalFrames.indexOf(null);
      if (emptyIndex !== -1) {
        optimalFrames[emptyIndex] = page;
      } else {
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
  if (performanceChart && timelineData.length > 0) {
    const labels = [];
    const hitRates = [];
    const faultRates = [];

    let currentHits = 0;
    let currentMisses = 0;

    for (let i = 0; i < timelineData.length; i++) {
      labels.push(i + 1);

      const data = timelineData[i];
      if (data.hit) {
        currentHits++;
      } else {
        currentMisses++;
      }

      const total = currentHits + currentMisses;
      const currentHitRate =
        total > 0 ? Math.round((currentHits / total) * 100) : 0;
      const currentFaultRate =
        total > 0 ? Math.round((currentMisses / total) * 100) : 0;

      hitRates.push(currentHitRate);
      faultRates.push(currentFaultRate);
    }

    performanceChart.data.labels = labels;
    performanceChart.data.datasets[0].data = hitRates;
    performanceChart.data.datasets[1].data = faultRates;
    performanceChart.update();
  }
}

function runAlgorithmComparison() {
  const referenceInput = document.getElementById("comparison-reference").value;
  const comparisonReference = referenceInput
    .split(",")
    .map((num) => parseInt(num.trim()))
    .filter((num) => !isNaN(num));
  const comparisonFrameCount = parseInt(
    document.getElementById("comparison-frame-slider").value
  );

  if (comparisonReference.length === 0) {
    alert("Masukkan string referensi yang valid!");
    return;
  }

  const compareBtn = document.getElementById("run-comparison");
  compareBtn.disabled = true;
  compareBtn.classList.add("loading-btn");

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

      // Set "Write" toggle ke false untuk perbandingan yang adil (fair)
      // Biaya I/O dari M-bit akan diabaikan di sini
      document.getElementById("write-toggle").checked = false;

      while (currentStep < referenceString.length) {
        performStep(true); // Silent mode
      }

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
    document.getElementById("reference-input").value =
      referenceString.join(",");
    document.getElementById("frame-slider").value = frameCount;
    document.getElementById("frame-value").textContent = frameCount;
    resetSimulation();
    renderReferenceString();

    // Update chart perbandingan
    comparisonChart.data.labels = [
      "FIFO",
      "LRU",
      "Optimal",
    ];
    comparisonChart.data.datasets[0].data = hitRates;
    comparisonChart.data.datasets[1].data = faultCounts;
    comparisonChart.update();

    addLog(`Perbandingan selesai!`, "text-primary font-bold");

    compareBtn.disabled = false;
    compareBtn.classList.remove("loading-btn");
  }, 50);
}

function renderQueueVisualization() {
  const container = document.getElementById("queue-container");
  const visualizer = document.getElementById("queue-visualization");
  const algoNameEl = document.getElementById("queue-algo-name");
  container.innerHTML = "";

  let queue = [];
  if (currentAlgorithm === "fifo" || currentAlgorithm === "lfu") {
    queue = fifoQueue;
    algoNameEl.textContent =
      currentAlgorithm === "lfu" ? "LFU (FIFO Tie-break)" : "FIFO";
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
    container.innerHTML =
      '<span class="text-gray-500 italic">Antrian kosong</span>';
    return;
  }

  queue.forEach((page, index) => {
    const pageElement = document.createElement("div");
    pageElement.className = "queue-page";
    pageElement.textContent = page;

    const labelElement = document.createElement("div");
    labelElement.className = "queue-label";

    if (index === 0) {
      labelElement.textContent =
        currentAlgorithm === "lru" ? "TERLAMA" : "DEPAN";
    }
    if (index === queue.length - 1) {
      labelElement.textContent =
        currentAlgorithm === "lru" ? "TERBARU" : "BELAKANG";
    }

    const wrapper = document.createElement("div");
    wrapper.appendChild(pageElement);
    wrapper.appendChild(labelElement);
    container.appendChild(wrapper);
  });
}

function toggleAlgorithmDetail(algorithm) {
  const detailElement = document.getElementById(`${algorithm}-detail`);
  const toggleIcon = document
    .getElementById(`${algorithm}-detail-toggle`)
    .querySelector("i");

  if (detailElement.classList.contains("open")) {
    detailElement.classList.remove("open");
    toggleIcon.classList.remove("fa-chevron-up");
    toggleIcon.classList.add("fa-chevron-down");
    toggleIcon.classList.remove("rotate-180");
  } else {
    document.querySelectorAll(".algorithm-details").forEach((el) => {
      el.classList.remove("open");
    });
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

  const defaultMessage = logContainer.querySelector(".text-gray-500");
  if (defaultMessage) {
    defaultMessage.remove();
  }

  const logEntry = document.createElement("p");
  logEntry.className = `${className} mb-1`;
  logEntry.textContent = message;

  logContainer.appendChild(logEntry);

  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }

  logContainer.scrollTop = logContainer.scrollHeight;
}

// Tutup menu saat link diklik
document.querySelectorAll(".mobile-menu-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.getElementById("mobile-menu").classList.add("hidden");
    document.getElementById("mobile-menu-icon").classList.remove("fa-xmark");
    document.getElementById("mobile-menu-icon").classList.add("fa-bars");
  });
});
