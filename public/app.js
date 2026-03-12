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
      renderMembers(allMembers);
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

    // Slice for pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const membersToShow = currentFilteredMembers.slice(startIndex, endIndex);

    membersToShow.forEach((member) => {
      const card = document.createElement("div");
      card.className = `member-card ${member.type}`;

      // Image handling
      let imageHtml = "";
      if (member.type === "Firmenmitglied" && member.image) {
        imageHtml = `<img src="${member.image}" alt="${member.name}" class="member-logo">`;
      } else {
        // Placeholder or nothing
        imageHtml = `<div class="member-logo" style="display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px;">${member.name.charAt(
          0
        )}</div>`;
      }

      // Website handling
      let websiteHtml = "";
      if (member.website) {
        // Ensure protocol
        let url = member.website;
        if (!url.startsWith("http")) url = "https://" + url;
        websiteHtml = `<p><span class="icon">🌐</span> <a href="${url}" target="_blank">Webseite</a></p>`;
      } else if (member.type === "Firmenmitglied") {
        // Maybe link to details?
      }

      card.innerHTML = `
                <div class="member-header">
                    ${imageHtml}
                    <div class="member-info">
                        <h3>${member.name}</h3>
                        <span class="member-type">${member.type}</span>
                    </div>
                </div>
                <div class="member-details">
                    ${
                      member.address.city
                        ? `<p><span class="icon">📍</span> ${member.address.zip} ${member.address.city}</p>`
                        : ""
                    }
                    ${
                      member.phone
                        ? `<p><span class="icon">📞</span> <a href="tel:${member.phone}">${member.phone}</a></p>`
                        : ""
                    }
                    ${
                      member.email
                        ? `<p><span class="icon">✉️</span> <a href="mailto:${member.email}">${member.email}</a></p>`
                        : ""
                    }
                    ${websiteHtml}
                </div>
            `;
      container.appendChild(card);
    });

    // Show message if empty
    if (membersToShow.length === 0) {
      container.innerHTML =
        '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">Keine Mitglieder gefunden.</p>';
    }
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

    members.forEach((member) => {
      if (member.coords) {
        const marker = L.marker([member.coords.lat, member.coords.lon]);
        marker.bindPopup(`<b>${member.name}</b><br>${member.address.city}`);
        markers.addLayer(marker);
      }
    });

    // Fit bounds if markers exist
    if (markers.getLayers().length > 0) {
      const group = new L.featureGroup(markers.getLayers());
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
});
