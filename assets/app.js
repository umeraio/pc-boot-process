/* ==========================================================
   Windows Boot Timeline (Disk → RAM Visual + Slider)
   + Secure Boot / TPM indicators
   + CPU Control owner
   + Modal popups with:
     - Where it lives (ESP / Windows / RAM / UEFI)
     - Mini diagram (no libraries)
   Mount: <section data-win-timeline-visual></section>
   ========================================================== */
(function(){
  const host = document.querySelector("[data-win-timeline-visual]");
  if(!host) return;

  // ---------- Modal (shared) ----------
  const modal = ensureModal();

  function openModal({ title, body, where }){
    modal.title.textContent = title;

    // Build rich modal body content
    modal.body.innerHTML = `
      <div>${escapeHtml(body)}</div>

      <div class="where" aria-label="Where it lives">
        <div>📍 <b>Where it lives:</b> <span class="wtag">${escapeHtml(where.label)}</span></div>
        <div class="wtag">${escapeHtml(where.hint)}</div>
      </div>

      ${renderMiniDiagram(where.kind)}

      <div class="mini-caption">
        The diagram shows the idea of <b>where the thing comes from</b> (ESP/Windows/Firmware)
        and <b>where it goes</b> (RAM) before the CPU can run it.
      </div>
    `;

    modal.overlay.classList.add("show");
    modal.closeBtn.focus();
  }

  function closeModal(){
    modal.overlay.classList.remove("show");
  }

  function renderMiniDiagram(kind){
    // kind: "esp" | "win" | "ram" | "uefi" | "generic"
    // We show a simple pipeline:
    //   Firmware/Partition -> RAM -> CPU executes
    let sourceNode = "";
    if(kind === "esp"){
      sourceNode = `<div class="node esp"><span class="n-dot"></span>ESP (boot files)</div>`;
    } else if(kind === "win"){
      sourceNode = `<div class="node win"><span class="n-dot"></span>Windows partition</div>`;
    } else if(kind === "ram"){
      sourceNode = `<div class="node ram"><span class="n-dot"></span>Already in RAM</div>`;
    } else if(kind === "uefi"){
      sourceNode = `<div class="node uefi"><span class="n-dot"></span>UEFI firmware chip</div>`;
    } else {
      sourceNode = `<div class="node"><span class="n-dot"></span>Storage/Firmware</div>`;
    }

    // If it's already in RAM, show RAM first then CPU
    if(kind === "ram"){
      return `
        <div class="mini-diagram" aria-label="Mini diagram">
          <div class="mini-row">
            ${sourceNode}
            <span class="arrow">→</span>
            <div class="node"><span class="n-dot"></span>CPU runs it ✅</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="mini-diagram" aria-label="Mini diagram">
        <div class="mini-row">
          ${sourceNode}
          <span class="arrow">→</span>
          <div class="node ram"><span class="n-dot"></span>RAM (loaded)</div>
          <span class="arrow">→</span>
          <div class="node"><span class="n-dot"></span>CPU runs it ✅</div>
        </div>
      </div>
    `;
  }

  // ---------- Steps ----------
  const steps = [
    {
      icon:"⚡", title:"Power On", sub:"Hardware wakes up", layer:"Hardware",
      controller:{icon:"⚡", name:"Hardware/CPU reset"},
      secureBoot:false, tpm:false,
      explain:"You press the power button. Electricity flows. The CPU resets and starts from its first instruction.",
      diskFocus:"none",
      toRAM:[]
    },
    {
      icon:"🧠", title:"UEFI firmware", sub:"Checks + finds boot entry", layer:"Firmware",
      controller:{icon:"🧠", name:"UEFI firmware"},
      secureBoot:true, tpm:true,
      explain:"UEFI runs from the motherboard firmware chip. It checks devices and chooses a boot option from the UEFI boot list.",
      diskFocus:"esp",
      toRAM:[
        {label:"UEFI boot entry", source:"uefi", note:"UEFI reads saved boot options (NVRAM).", where:{kind:"uefi", label:"UEFI (firmware)", hint:"Stored in motherboard firmware + boot list"} },
        {label:"ESP located", source:"esp", note:"UEFI finds the EFI System Partition (ESP).", where:{kind:"esp", label:"ESP", hint:"Small EFI System Partition on the disk"} }
      ]
    },
    {
      icon:"🚀", title:"Windows Boot Manager", sub:"Loads from ESP", layer:"Boot Loader",
      controller:{icon:"🚀", name:"bootmgfw.efi (Boot Manager)"},
      secureBoot:true, tpm:true,
      explain:"UEFI loads Windows Boot Manager from the EFI System Partition and runs it. This is the key handover step.",
      diskFocus:"esp",
      toRAM:[
        {label:"\\EFI\\Microsoft\\Boot\\bootmgfw.efi", source:"esp", note:"Windows Boot Manager file loaded and executed.",
          where:{kind:"esp", label:"ESP", hint:"UEFI loads this EFI file from ESP"}
        }
      ]
    },
    {
      icon:"📋", title:"Boot Configuration (BCD)", sub:"Reads startup choices", layer:"Boot Loader",
      controller:{icon:"📋", name:"Boot Manager reading BCD"},
      secureBoot:true, tpm:true,
      explain:"Boot Manager reads the BCD settings. It decides which Windows installation to boot and which options to use.",
      diskFocus:"esp",
      toRAM:[
        {label:"BCD store", source:"esp", note:"Boot settings database (OS entry, recovery, options).",
          where:{kind:"esp", label:"ESP", hint:"Boot configuration database stored on disk"}
        }
      ]
    },
    {
      icon:"📦", title:"Windows OS Loader", sub:"Loads kernel pieces", layer:"Boot Loader",
      controller:{icon:"📦", name:"winload.efi (OS Loader)"},
      secureBoot:true, tpm:true,
      explain:"Boot Manager starts the OS Loader, which loads the kernel and essential boot drivers into memory.",
      diskFocus:"win",
      toRAM:[
        {label:"winload.efi", source:"win", note:"Windows OS Loader runs (UEFI mode).",
          where:{kind:"win", label:"Windows partition", hint:"Stored with Windows system files"}
        },
        {label:"ntoskrnl.exe", source:"win", note:"Windows kernel image (core).",
          where:{kind:"win", label:"Windows partition", hint:"Kernel file stored on Windows disk partition"}
        },
        {label:"HAL", source:"win", note:"Hardware Abstraction Layer (helps kernel talk to hardware).",
          where:{kind:"win", label:"Windows partition", hint:"System component stored with Windows files"}
        },
        {label:"Boot-start drivers", source:"win", note:"Critical drivers for storage and early boot.",
          where:{kind:"win", label:"Windows partition", hint:"Essential drivers stored with system files"}
        }
      ]
    },
    {
      icon:"⚙️", title:"Kernel starts", sub:"CPU + memory control", layer:"Kernel",
      controller:{icon:"⚙️", name:"Windows kernel (ntoskrnl.exe)"},
      secureBoot:false, tpm:true,
      explain:"The kernel takes control. It sets up scheduling, memory protection, and continues initializing drivers.",
      diskFocus:"win",
      toRAM:[
        {label:"Kernel running", source:"ram", note:"Kernel begins executing from RAM.",
          where:{kind:"ram", label:"RAM", hint:"Now running from memory (not disk)"}
        },
        {label:"Driver init", source:"ram", note:"Drivers start and hardware becomes usable.",
          where:{kind:"ram", label:"RAM", hint:"Driver code is executing from memory"}
        }
      ]
    },
    {
      icon:"🧑‍🔧", title:"System services", sub:"OS becomes usable", layer:"Operating System",
      controller:{icon:"🧑‍🔧", name:"Windows services + system processes"},
      secureBoot:false, tpm:true,
      explain:"Windows starts core system processes and services. Networking, security, and background components come online.",
      diskFocus:"win",
      toRAM:[
        {label:"System services", source:"win", note:"Background services start (high-level).",
          where:{kind:"win", label:"Windows partition", hint:"Service binaries loaded from disk to RAM"}
        },
        {label:"More drivers", source:"win", note:"Additional drivers load for devices.",
          where:{kind:"win", label:"Windows partition", hint:"Drivers are loaded from disk to RAM as needed"}
        }
      ]
    },
    {
      icon:"😊", title:"Login screen", sub:"You can use Windows", layer:"User",
      controller:{icon:"😊", name:"User session (login/UI)"},
      secureBoot:false, tpm:true,
      explain:"You see the login screen. After login, your desktop session and apps start.",
      diskFocus:"win",
      toRAM:[
        {label:"User session", source:"win", note:"User profile and UI components load after login.",
          where:{kind:"win", label:"Windows partition", hint:"UI/user components load from disk into RAM"}
        }
      ]
    }
  ];

  // Disk library (click chips -> modal)
  const espFiles = [
    {label:"ESP: \\EFI\\Microsoft\\Boot\\bootmgfw.efi", tip:"Windows Boot Manager (UEFI boot file). It is loaded by UEFI.", where:{kind:"esp", label:"ESP", hint:"UEFI loads this file from ESP"} },
    {label:"ESP: BCD store", tip:"Boot Configuration Data. It tells Windows which OS to boot and what options to use.", where:{kind:"esp", label:"ESP", hint:"Boot database stored on ESP"} }
  ];

  const winFiles = [
    {label:"Windows: winload.efi", tip:"Windows OS Loader. It loads the kernel and early drivers into RAM.", where:{kind:"win", label:"Windows partition", hint:"Stored in Windows system files"} },
    {label:"Windows: ntoskrnl.exe", tip:"Windows kernel image. This is the core that controls CPU, memory, and devices.", where:{kind:"win", label:"Windows partition", hint:"Kernel stored on Windows partition"} },
    {label:"Windows: HAL", tip:"Hardware Abstraction Layer. Helps Windows kernel work with different hardware.", where:{kind:"win", label:"Windows partition", hint:"System component stored with Windows files"} },
    {label:"Windows: Boot-start drivers", tip:"Critical drivers needed early (especially storage/disk access).", where:{kind:"win", label:"Windows partition", hint:"Driver files stored with Windows system files"} },
    {label:"Windows: System services", tip:"Background services (networking, security, logging, and more).", where:{kind:"win", label:"Windows partition", hint:"Service binaries stored on disk"} }
  ];

  // ---------- UI ----------
  host.innerHTML = `
    <div class="timeline">
      <div class="timeline-top">
        <div>
          <div class="timeline-title">Windows Boot Timeline (UEFI → Login) - Disk → RAM</div>
          <div style="color: var(--muted); font-size: 12.5px; margin-top: 2px;">
            Drag the slider to move through boot stages. Watch files “fly” from Disk to RAM.
          </div>

          <div class="indicators" aria-label="Security and control indicators">
            <div class="ind" title="Secure Boot is mainly checked during UEFI loading of signed boot files.">
              <span class="light sb" data-sb></span>
              <span>Secure Boot</span>
            </div>
            <div class="ind" title="TPM is a security chip. Here we show it as relevant during secure startup and OS security.">
              <span class="light tpm" data-tpm></span>
              <span>TPM</span>
            </div>
            <div class="control-pill" aria-label="Who has control now">
              <span class="ctrl-badge" data-ctrlIcon>🧠</span>
              <span><b>Control:</b> <span data-ctrlName>UEFI</span></span>
            </div>
          </div>
        </div>

        <div class="pill" data-pill>Step 1/${steps.length}</div>
      </div>

      <div class="slider-row">
        <input class="range" type="range" min="0" max="${steps.length-1}" value="0" step="1"
          aria-label="Windows boot timeline slider" data-range />
        <div class="t-btns">
          <button class="small" data-prev>◀ Previous</button>
          <button class="small" data-next>Next ▶</button>
          <button class="small" data-auto>⏵ Auto</button>
          <button class="small" data-stop>⏸ Stop</button>
        </div>
      </div>

      <div class="bootviz">
        <div class="panel" aria-label="Disk view panel">
          <div class="panel-head">
            <div>
              <div class="title">💽 Disk view</div>
              <div class="mini">ESP and Windows partition (sources of boot files)</div>
            </div>
            <div class="pill" data-diskpill>Focus: -</div>
          </div>

          <div class="disk">
            <div class="partition" data-esp>
              <div class="part-top">
                <div>
                  <div class="part-name">🧠 EFI System Partition (ESP)</div>
                  <div class="part-sub">Stores UEFI boot files</div>
                </div>
                <div class="part-tag">Source: ESP</div>
              </div>
              <div class="filelist" data-espfiles></div>
            </div>

            <div class="partition" data-win>
              <div class="part-top">
                <div>
                  <div class="part-name">🪟 Windows Partition</div>
                  <div class="part-sub">Stores Windows system files</div>
                </div>
                <div class="part-tag">Source: Windows</div>
              </div>
              <div class="filelist" data-winfiles></div>
            </div>
          </div>
        </div>

        <div class="panel ram" aria-label="RAM view panel">
          <div class="panel-head">
            <div>
              <div class="title">🧠 RAM view</div>
              <div class="mini">What is currently loaded and running</div>
            </div>
            <div class="pill" data-layerpill>Layer: -</div>
          </div>

          <div class="ram-zone">
            <div class="ram-title" data-stageTitle>Stage</div>
            <div class="ramlist" data-ramlist></div>
            <div class="ramhint" data-stageText></div>
            <div class="fly-layer" data-flylayer></div>
          </div>

          <div class="legend" aria-label="Legend">
            <div class="pill">● ESP files</div>
            <div class="pill">● Windows files</div>
            <div class="pill">● Now in RAM</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 10px; color: var(--muted); font-size: 12.5px;">
        Tip: Click any file chip to see a short explanation (modal with diagram).
      </div>
    </div>
  `;

  // ---------- DOM refs ----------
  const range = host.querySelector("[data-range]");
  const pill  = host.querySelector("[data-pill]");
  const prev  = host.querySelector("[data-prev]");
  const next  = host.querySelector("[data-next]");
  const auto  = host.querySelector("[data-auto]");
  const stop  = host.querySelector("[data-stop]");

  const espPart = host.querySelector("[data-esp]");
  const winPart = host.querySelector("[data-win]");
  const espWrap = host.querySelector("[data-espfiles]");
  const winWrap = host.querySelector("[data-winfiles]");

  const diskPill  = host.querySelector("[data-diskpill]");
  const layerPill = host.querySelector("[data-layerpill]");
  const stageTitle= host.querySelector("[data-stageTitle]");
  const stageText = host.querySelector("[data-stageText]");
  const ramList   = host.querySelector("[data-ramlist]");
  const flyLayer  = host.querySelector("[data-flylayer]");

  const sbLight   = host.querySelector("[data-sb]");
  const tpmLight  = host.querySelector("[data-tpm]");
  const ctrlIcon  = host.querySelector("[data-ctrlIcon]");
  const ctrlName  = host.querySelector("[data-ctrlName]");

  let timer = null;
  let ramState = [];

  // ---------- Chips ----------
  function mkChip(label, whereKind, tip, whereObj){
    const div = document.createElement("div");
    div.className = "filecard";
    const badgeClass = whereKind === "esp" ? "esp" : "win";
    div.innerHTML = `<span class="filebadge ${badgeClass}"></span><span>${escapeHtml(label)}</span>`;
    div.addEventListener("click", ()=>{
      openModal({
        title: label,
        body: tip,
        where: whereObj || {kind:"generic", label:"Disk/Firmware", hint:"Loaded into RAM before execution"}
      });
    });
    return div;
  }

  espFiles.forEach(f=> espWrap.appendChild(mkChip(f.label, "esp", f.tip, f.where)));
  winFiles.forEach(f=> winWrap.appendChild(mkChip(f.label, "win", f.tip, f.where)));

  function setFocus(which){
    espPart.classList.toggle("active", which === "esp");
    winPart.classList.toggle("active", which === "win");
    if(which === "esp") diskPill.textContent = "Focus: ESP";
    else if(which === "win") diskPill.textContent = "Focus: Windows";
    else diskPill.textContent = "Focus: Hardware";
  }

  function pushToRam(items){
    items.forEach(it=>{
      if(!ramState.some(x=> x.label === it.label)){
        ramState.push({label: it.label, note: it.note, where: it.where});
      }
    });
  }

  function renderRam(){
    ramList.innerHTML = "";
    if(!ramState.length){
      const empty = document.createElement("div");
      empty.style.color = "rgba(255,255,255,0.78)";
      empty.textContent = "Nothing loaded into RAM yet (still very early).";
      ramList.appendChild(empty);
      return;
    }

    ramState.forEach(r=>{
      const div = document.createElement("div");
      div.className = "filecard";
      div.innerHTML = `<span class="filebadge ram"></span><span>${escapeHtml(r.label)}</span>`;
      div.addEventListener("click", ()=>{
        openModal({
          title: r.label,
          body: r.note,
          where: r.where || {kind:"ram", label:"RAM", hint:"Already loaded and executing from memory"}
        });
      });
      ramList.appendChild(div);
    });
  }

  function fly(fromEl, toEl, label){
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();

    const el = document.createElement("div");
    el.className = "fly";
    el.innerHTML = `📄 <span>${escapeHtml(label)}</span>`;
    flyLayer.appendChild(el);

    const layerRect = flyLayer.getBoundingClientRect();
    const startX = (a.left + a.width*0.5) - layerRect.left;
    const startY = (a.top  + a.height*0.5) - layerRect.top;
    const endX   = (b.left + 70) - layerRect.left;
    const endY   = (b.top  + 50) - layerRect.top;

    el.style.left = `${Math.round(startX)}px`;
    el.style.top  = `${Math.round(startY)}px`;

    requestAnimationFrame(()=>{
      el.classList.add("show");
      el.style.transform = `translate3d(${Math.round(endX-startX)}px, ${Math.round(endY-startY)}px, 0)`;
      el.style.opacity = "1";
    });

    setTimeout(()=>{ el.remove(); }, 900);
  }

  function animateLoads(step){
    let fromContainer = null;
    if(step.diskFocus === "esp") fromContainer = espWrap;
    if(step.diskFocus === "win") fromContainer = winWrap;

    if(!fromContainer || !step.toRAM.length) return;

    step.toRAM.forEach((item, idx)=>{
      const chips = [...fromContainer.querySelectorAll(".filecard")];
      const key = item.label.replaceAll("\\","").split(" ")[0];
      const match = chips.find(c => c.textContent.includes(key)) || chips[0];
      if(!match) return;
      setTimeout(()=> fly(match, stageTitle, item.label), 120 * idx);
    });
  }

  function setIndicators(step){
    sbLight.classList.toggle("on", !!step.secureBoot);
    tpmLight.classList.toggle("on", !!step.tpm);
    ctrlIcon.textContent = step.controller?.icon || "➡️";
    ctrlName.textContent = step.controller?.name || "Unknown";
  }

  function setStep(i, userAction=false){
    i = Math.max(0, Math.min(steps.length-1, i));
    range.value = String(i);

    const s = steps[i];
    pill.textContent = `Step ${i+1}/${steps.length}`;
    layerPill.textContent = `Layer: ${s.layer}`;

    stageTitle.textContent = `${s.icon} ${s.title} - ${s.sub}`;
    stageText.textContent = s.explain;

    setIndicators(s);
    setFocus(s.diskFocus);

    pushToRam(s.toRAM);
    renderRam();

    flyLayer.innerHTML = "";
    animateLoads(s);

    prev.disabled = i === 0;
    next.disabled = i === steps.length - 1;

    if(userAction) stopAuto();
  }

  function stepNext(){
    const i = Number(range.value);
    if(i < steps.length - 1) setStep(i+1);
  }
  function stepPrev(){
    const i = Number(range.value);
    if(i > 0) setStep(i-1);
  }

  function startAuto(){
    stopAuto();
    timer = setInterval(()=>{
      const i = Number(range.value);
      if(i < steps.length - 1) setStep(i+1);
      else stopAuto();
    }, 1500);
  }
  function stopAuto(){
    if(timer){ clearInterval(timer); timer=null; }
  }

  range.addEventListener("input", ()=> setStep(Number(range.value), true));
  window.addEventListener("resize", ()=> setStep(Number(range.value)));
  prev.addEventListener("click", stepPrev);
  next.addEventListener("click", stepNext);
  auto.addEventListener("click", startAuto);
  stop.addEventListener("click", stopAuto);

  // Init
  setStep(0);

  // ---------- Helpers ----------
  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function ensureModal(){
    let overlay = document.querySelector("[data-modal-overlay]");
    if(overlay){
      return {
        overlay,
        title: overlay.querySelector("[data-modal-title]"),
        body: overlay.querySelector("[data-modal-body]"),
        closeBtn: overlay.querySelector("[data-modal-close]")
      };
    }

    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("data-modal-overlay","");
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Info dialog">
        <div class="modal-head">
          <h3 class="modal-title" data-modal-title>Title</h3>
          <button class="modal-close" data-modal-close type="button" aria-label="Close dialog">✖</button>
        </div>
        <div class="modal-body" data-modal-body>Body</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const title = overlay.querySelector("[data-modal-title]");
    const body  = overlay.querySelector("[data-modal-body]");
    const closeBtn = overlay.querySelector("[data-modal-close]");

    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay) closeModal();
    });
    closeBtn.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && overlay.classList.contains("show")){
        closeModal();
      }
    });

    return { overlay, title, body, closeBtn };
  }
})();
/* ==========================================================
   GLOBAL CLICK-BOX HANDLER (Restores clickable mini-diagrams)
   Works for ANY element with: data-info data-title data-body
   Optional: data-where="ESP|Windows|RAM|UEFI"
   ========================================================== */
(function(){
  // ---- modal bootstrap (reuse if already exists) ----
  function ensureModal(){
    let overlay = document.querySelector("[data-modal-overlay]");
    if(overlay){
      return {
        overlay,
        title: overlay.querySelector("[data-modal-title]"),
        body: overlay.querySelector("[data-modal-body]"),
        closeBtn: overlay.querySelector("[data-modal-close]")
      };
    }

    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("data-modal-overlay","");
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Info dialog">
        <div class="modal-head">
          <h3 class="modal-title" data-modal-title>Title</h3>
          <button class="modal-close" data-modal-close type="button" aria-label="Close dialog">✖</button>
        </div>
        <div class="modal-body" data-modal-body>Body</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("[data-modal-close]");

    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay) overlay.classList.remove("show");
    });
    closeBtn.addEventListener("click", ()=> overlay.classList.remove("show"));

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && overlay.classList.contains("show")){
        overlay.classList.remove("show");
      }
    });

    return {
      overlay,
      title: overlay.querySelector("[data-modal-title]"),
      body: overlay.querySelector("[data-modal-body]"),
      closeBtn
    };
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function renderMiniDiagram(kind){
    let sourceNode = "";
    if(kind === "ESP"){
      sourceNode = `<div class="node esp"><span class="n-dot"></span>ESP (boot files)</div>`;
    } else if(kind === "Windows"){
      sourceNode = `<div class="node win"><span class="n-dot"></span>Windows partition</div>`;
    } else if(kind === "UEFI"){
      sourceNode = `<div class="node uefi"><span class="n-dot"></span>UEFI firmware chip</div>`;
    } else if(kind === "RAM"){
      sourceNode = `<div class="node ram"><span class="n-dot"></span>Already in RAM</div>`;
      return `
        <div class="mini-diagram" aria-label="Mini diagram">
          <div class="mini-row">
            ${sourceNode}
            <span class="arrow">→</span>
            <div class="node"><span class="n-dot"></span>CPU runs it ✅</div>
          </div>
        </div>
      `;
    } else {
      sourceNode = `<div class="node"><span class="n-dot"></span>Storage/Firmware</div>`;
    }

    return `
      <div class="mini-diagram" aria-label="Mini diagram">
        <div class="mini-row">
          ${sourceNode}
          <span class="arrow">→</span>
          <div class="node ram"><span class="n-dot"></span>RAM (loaded)</div>
          <span class="arrow">→</span>
          <div class="node"><span class="n-dot"></span>CPU runs it ✅</div>
        </div>
      </div>
    `;
  }

  const modal = ensureModal();

  function openModal(title, body, where){
    const whereLabel = where || "Generic";
    const whereHint =
      where === "ESP" ? "Boot files live on the EFI System Partition." :
      where === "Windows" ? "Windows system files live on the Windows partition." :
      where === "UEFI" ? "Firmware runs from the motherboard chip (not the disk)." :
      where === "RAM" ? "Already loaded into memory (fast access)." :
      "Loaded into RAM before CPU runs it.";

    modal.title.textContent = title;

    modal.body.innerHTML = `
      <div>${escapeHtml(body)}</div>

      <div class="where" aria-label="Where it lives">
        <div>📍 <b>Where it lives:</b> <span class="wtag">${escapeHtml(whereLabel)}</span></div>
        <div class="wtag">${escapeHtml(whereHint)}</div>
      </div>

      ${renderMiniDiagram(whereLabel)}

      <div class="mini-caption">
        This shows the idea: <b>source</b> → <b>RAM</b> → <b>CPU runs it</b>.
      </div>
    `;

    modal.overlay.classList.add("show");
    modal.closeBtn.focus();
  }

  // ---- event delegation: makes boxes work even if added later ----
  document.addEventListener("click", (e)=>{
    const el = e.target.closest("[data-info]");
    if(!el) return;

    const title = el.getAttribute("data-title") || "Info";
    const body  = el.getAttribute("data-body")  || "No description provided.";
    const where = el.getAttribute("data-where") || "Generic";

    openModal(title, body, where);
  });
})();
/* ==========================================================
   RESTORE CLICKABLE MINI-DIAGRAM + FLOWCHART BOXES
   Works with your existing HTML:
   - clickable elements: .node[data-pop-title][data-pop-text]
   - output container: [data-pop]
   ========================================================== */
(function(){
  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function renderPop(targetNode){
    const box = targetNode.closest(".diagram")?.querySelector("[data-pop]");
    if(!box) return;

    const title = targetNode.getAttribute("data-pop-title") || "Info";
    const text  = targetNode.getAttribute("data-pop-text")  || "";

    box.innerHTML = `
      <div style="font-weight:900; margin-bottom:6px;">${escapeHtml(title)}</div>
      <div style="color: rgba(255,255,255,0.86); line-height: 1.45;">
        ${escapeHtml(text)}
      </div>
    `;
    box.classList.add("show");
  }

  // Click to show explanation
  document.addEventListener("click", (e)=>{
    const node = e.target.closest(".node[data-pop-title][data-pop-text]");
    if(!node) return;
    renderPop(node);
  });

  // Optional hover preview (does not force open on mobile)
  document.addEventListener("mouseover", (e)=>{
    const node = e.target.closest(".node[data-pop-title][data-pop-text]");
    if(!node) return;

    // If user is on touch device, ignore hover behavior
    if(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

    renderPop(node);
  });
})();
