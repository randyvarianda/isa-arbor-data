document.addEventListener("DOMContentLoaded", () => {
  // Initialize Map
  // Center on Germany (approx)
  const map = L.map("map").setView([51.1657, 10.4515], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const markers = L.layerGroup().addTo(map);
  let allMembers = [];

  // Fetch Data
  fetch("data.json")
    .then((response) => response.json())
    .then((data) => {
      allMembers = data;
      currentFilteredMembers = data;
      renderPagination();
      renderMembers();
      renderMap(allMembers);
    })
    .catch((err) => console.error("Error loading data:", err));

  // Filter Logic
  const searchInput = document.getElementById("searchInput");
  const tabBtns = document.querySelectorAll(".tab-btn");
  let currentType = "all";

  // Pagination State
  let currentPage = 1;
  const itemsPerPage = 12;
  let currentFilteredMembers = [];

  function filterMembers() {
    const term = searchInput.value.toLowerCase();

    const filtered = allMembers.filter((member) => {
      // Search Text
      const searchable = [
        member.name || "",
        member.address.city || "",
        member.address.zip || "",
        member.email || "",
        member.type || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchable.includes(term);

      // Filter Type
      const matchesType = currentType === "all" || member.type === currentType;

      return matchesSearch && matchesType;
    });

    // Update State
    currentFilteredMembers = filtered;
    currentPage = 1; // Reset to page 1 on filter change

    renderPagination();
    renderMembers(); // Will use currentFilteredMembers and currentPage
    renderMap(filtered); // Map always shows all filtered results
  }

  searchInput.addEventListener("input", filterMembers);

  // Tab Click Handlers
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all
      tabBtns.forEach((b) => b.classList.remove("active"));
      // Add to clicked
      btn.classList.add("active");

      // Update filter
      currentType = btn.getAttribute("data-type");
      filterMembers();
    });
  });

  // Render List
  function renderMembers() {
    const container = document.getElementById("members-list");
    container.innerHTML = "";
    container.className = "members-table";

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (ch) => {
        switch (ch) {
          case "&":
            return "&amp;";
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case '"':
            return "&quot;";
          case "'":
            return "&#39;";
          default:
            return ch;
        }
      });
    }

    function normalizeWebsite(raw) {
      const v = String(raw ?? "").trim();
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return v;
      return `https://${v}`;
    }

    function normalizePhone(raw) {
      const display = String(raw ?? "").trim();
      if (!display) return null;
      const tel = display.replace(/[^\d+]/g, "");
      return { display, tel: tel || display };
    }

    // Slice for pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const membersToShow = currentFilteredMembers.slice(startIndex, endIndex);

    if (membersToShow.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; padding: 40px; color: #888;">Keine Mitglieder gefunden.</div>';
      return;
    }

    const iconPhone = `<svg class="contact-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.06a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92z"/></svg>`;
    const iconMail = `<svg class="contact-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>`;
    const iconGlobe = `<svg class="contact-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z"/><path d="M2 12h20"/><path d="M12 2c2.6 2.8 4 6.4 4 10s-1.4 7.2-4 10c-2.6-2.8-4-6.4-4-10s1.4-7.2 4-10z"/></svg>`;
    const iconExternal = `<svg class="external-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`;

    const rowsHtml = membersToShow
      .map((member) => {
        const isFirma = member.type === "Firmenmitglied";
        const name = escapeHtml(member.name);
        const zip = escapeHtml(member?.address?.zip);
        const city = escapeHtml(member?.address?.city);
        const zipCity = [zip, city].filter(Boolean).join(" ");

        const phone = normalizePhone(member.phone);
        const emailRaw = String(member.email ?? "").trim();
        const email = emailRaw ? escapeHtml(emailRaw) : "";
        const emailHref = emailRaw
          ? `mailto:${encodeURIComponent(emailRaw)}`
          : "";
        const websiteUrl = normalizeWebsite(member.website);
        const websiteHref = websiteUrl ? escapeHtml(websiteUrl) : "";

        let logoHtml = `<div class="table-logo-fallback">${name.charAt(
          0
        )}</div>`;
        if (member.image) {
          logoHtml = `<img class="table-logo" src="${escapeHtml(
            member.image
          )}" alt="${name}">`;
        }

        let nameHtml = name;
        if (websiteUrl) {
          nameHtml = `<a class="name-link" href="${websiteHref}" target="_blank" rel="noopener noreferrer">${name}${iconExternal}</a>`;
        } else {
          nameHtml = `<span class="name-text">${name}</span>`;
        }

        const typeLabel = isFirma ? "Firma" : "Einzel";
        const typePill = `<span class="type-pill ${
          isFirma ? "firma" : "einzel"
        }">${typeLabel}</span>`;

        const phoneIcon = phone
          ? `<a class="contact-icon" href="tel:${escapeHtml(
              phone.tel
            )}" title="${escapeHtml(phone.display)}">${iconPhone}</a>`
          : `<span class="contact-icon disabled" aria-hidden="true">${iconPhone}</span>`;
        const mailIcon = emailRaw
          ? `<a class="contact-icon" href="${emailHref}" title="${email}">${iconMail}</a>`
          : `<span class="contact-icon disabled" aria-hidden="true">${iconMail}</span>`;
        const webIcon = websiteUrl
          ? `<a class="contact-icon" href="${websiteHref}" target="_blank" rel="noopener noreferrer" title="Webseite">${iconGlobe}</a>`
          : `<span class="contact-icon disabled" aria-hidden="true">${iconGlobe}</span>`;

        return `
          <tr>
            <td class="name-cell">
              <div class="name-wrap">
                <div class="logo-wrap">${logoHtml}</div>
                <div class="name-meta">
                  <div class="name-row">${nameHtml}</div>
                </div>
              </div>
            </td>
            <td class="type-cell">${typePill}</td>
            <td class="city-cell">${zipCity}</td>
            <td class="contact-cell">
              <div class="contact-icons">
                ${phoneIcon}
                ${mailIcon}
                ${webIcon}
              </div>
            </td>
          </tr>
        `.trim();
      })
      .join("");

    container.innerHTML = `
      <table>
        <colgroup>
          <col />
          <col style="width: 110px;" />
          <col style="width: 220px;" />
          <col style="width: 190px;" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Typ</th>
            <th>Ort</th>
            <th>Kontakt</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `.trim();
  }

  // Render Pagination Controls
  function renderPagination() {
    const container = document.getElementById("pagination");
    container.innerHTML = "";

    const totalPages = Math.ceil(currentFilteredMembers.length / itemsPerPage);

    if (totalPages <= 1) return;

    // Previous
    const prevBtn = document.createElement("button");
    prevBtn.innerText = "←";
    prevBtn.className = "page-btn";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderMembers();
        renderPagination();
        window.scrollTo({
          top: document.getElementById("members-list").offsetTop - 100,
          behavior: "smooth",
        });
      }
    };
    container.appendChild(prevBtn);

    // Pages (simple version: show all or max 5?)
    // Let's do simple: 1, 2, ... current ... last
    // For simplicity in this demo, let's just show current +/- 2

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      const firstBtn = document.createElement("button");
      firstBtn.innerText = "1";
      firstBtn.className = "page-btn";
      firstBtn.onclick = () => {
        currentPage = 1;
        renderMembers();
        renderPagination();
        window.scrollTo({
          top: document.getElementById("members-list").offsetTop - 100,
          behavior: "smooth",
        });
      };
      container.appendChild(firstBtn);

      if (startPage > 2) {
        const dots = document.createElement("span");
        dots.innerText = "...";
        dots.style.alignSelf = "center";
        container.appendChild(dots);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement("button");
      btn.innerText = i;
      btn.className = `page-btn ${i === currentPage ? "active" : ""}`;
      btn.onclick = () => {
        currentPage = i;
        renderMembers();
        renderPagination();
        window.scrollTo({
          top: document.getElementById("members-list").offsetTop - 100,
          behavior: "smooth",
        });
      };
      container.appendChild(btn);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const dots = document.createElement("span");
        dots.innerText = "...";
        dots.style.alignSelf = "center";
        container.appendChild(dots);
      }
      const lastBtn = document.createElement("button");
      lastBtn.innerText = totalPages;
      lastBtn.className = "page-btn";
      lastBtn.onclick = () => {
        currentPage = totalPages;
        renderMembers();
        renderPagination();
        window.scrollTo({
          top: document.getElementById("members-list").offsetTop - 100,
          behavior: "smooth",
        });
      };
      container.appendChild(lastBtn);
    }

    // Next
    const nextBtn = document.createElement("button");
    nextBtn.innerText = "→";
    nextBtn.className = "page-btn";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderMembers();
        renderPagination();
        window.scrollTo({
          top: document.getElementById("members-list").offsetTop - 100,
          behavior: "smooth",
        });
      }
    };
    container.appendChild(nextBtn);
  }

  // Render Map Markers
  function renderMap(members) {
    markers.clearLayers();
    map.setView([51.1657, 10.4515], 6);

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (ch) => {
        switch (ch) {
          case "&":
            return "&amp;";
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case '"':
            return "&quot;";
          case "'":
            return "&#39;";
          default:
            return ch;
        }
      });
    }

    function normalizeWebsite(raw) {
      const v = String(raw ?? "").trim();
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return v;
      return `https://${v}`;
    }

    function normalizePhone(raw) {
      const display = String(raw ?? "").trim();
      if (!display) return null;
      const tel = display.replace(/[^\d+]/g, "");
      return { display, tel: tel || display };
    }

    function markerStyleForType(type) {
      if (type === "Firmenmitglied") {
        return { color: "#7DBB55", fillColor: "#C8F69B" };
      }
      if (type === "Einzelmitglied") {
        return { color: "#1F5D8F", fillColor: "#3498DB" };
      }
      return { color: "#555", fillColor: "#999" };
    }

    function popupHtmlForMember(member) {
      const name = escapeHtml(member?.name);
      const type = escapeHtml(member?.type);
      const street = escapeHtml(member?.address?.street);
      const zip = escapeHtml(member?.address?.zip);
      const city = escapeHtml(member?.address?.city);
      const country = escapeHtml(member?.address?.country);
      const phone = normalizePhone(member?.phone);
      const emailRaw = String(member?.email ?? "").trim();
      const email = emailRaw ? escapeHtml(emailRaw) : "";
      const emailHref = emailRaw
        ? `mailto:${encodeURIComponent(emailRaw)}`
        : "";
      const websiteUrl = normalizeWebsite(member?.website);
      const websiteHref = websiteUrl ? escapeHtml(websiteUrl) : "";
      const imageSrc =
        member?.type === "Firmenmitglied" && member?.image
          ? escapeHtml(member.image)
          : "";

      const addressLines = [];
      if (street) addressLines.push(street);
      const zipCity = [zip, city].filter(Boolean).join(" ");
      if (zipCity) addressLines.push(zipCity);
      if (country) addressLines.push(country);

      const addressHtml = addressLines.length
        ? `<div style="margin-top:6px;opacity:0.9;">${addressLines
            .map((l) => `<div>${l}</div>`)
            .join("")}</div>`
        : "";

      const phoneHtml = phone
        ? `<div style="margin-top:6px;"><span class="icon">📞</span> <a href="tel:${escapeHtml(
            phone.tel
          )}">${escapeHtml(phone.display)}</a></div>`
        : "";

      const emailHtml = emailRaw
        ? `<div style="margin-top:6px;"><span class="icon">✉️</span> <a href="${emailHref}">${email}</a></div>`
        : "";

      const websiteHtml = websiteUrl
        ? `<div style="margin-top:6px;"><span class="icon">🌐</span> <a href="${websiteHref}" target="_blank" rel="noopener noreferrer">Webseite</a></div>`
        : "";

      const imageHtml = imageSrc
        ? `<div style="margin-top:8px;"><img src="${imageSrc}" alt="${name}" style="max-width:140px;max-height:60px;object-fit:contain;display:block;"></div>`
        : "";

      return `
        <div style="min-width:220px;">
          <div style="font-weight:700;">${name}</div>
          <div style="margin-top:2px;opacity:0.75;font-size:12px;">${type}</div>
          ${addressHtml}
          ${phoneHtml}
          ${emailHtml}
          ${websiteHtml}
          ${imageHtml}
        </div>
      `.trim();
    }

    members.forEach((member) => {
      if (member.coords) {
        const style = markerStyleForType(member.type);
        const marker = L.circleMarker([member.coords.lat, member.coords.lon], {
          radius: 7,
          color: style.color,
          weight: 2,
          fillColor: style.fillColor,
          fillOpacity: 0.9,
        });
        marker.bindPopup(popupHtmlForMember(member));
        markers.addLayer(marker);
      }
    });
  }
});
