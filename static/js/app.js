const API_BASE = "/api";

function formatIDR(num) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  toast.classList.add("toast");
  if (type === "success") toast.classList.add("success");
  else if (type === "error") toast.classList.add("error");

  toast.textContent = message;

  // Klik untuk langsung hilang
  toast.addEventListener("click", () => {
    toast.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => toast.remove(), 500);
  });

  container.appendChild(toast);

  // Hapus otomatis setelah animasi selesai (5 detik)
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}


async function fetchData() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    return await res.json();
  } catch (e) {
    showToast("Gagal mengambil data dari server");
    return null;
  }
}

async function updateUI() {
  const data = await fetchData();
  if (!data) return;

  document.getElementById("cash-balance").textContent = formatIDR(data.cash);
  document.getElementById("atm-balance").textContent = formatIDR(data.atm);

  // Crypto List
  const cryptoListDiv = document.getElementById("crypto-list");
  cryptoListDiv.innerHTML = "";
  if (Object.keys(data.crypto).length === 0) {
    cryptoListDiv.textContent = "Belum ada crypto";
  } else {
    for (const [token, amount] of Object.entries(data.crypto)) {
      const div = document.createElement("div");
      div.textContent = `${token.toUpperCase()}: ${formatIDR(amount)}`;
      cryptoListDiv.appendChild(div);
    }
  }

  // Goals
  const goalsList = document.getElementById("goals-list");
  goalsList.innerHTML = "";
  data.goals.forEach(goal => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${goal.name} - Target: ${formatIDR(goal.target)}</span>
      <button class="btn red btn-delete-goal" data-id="${goal.id}">Hapus</button>
      <div class="goal-progress"><div class="goal-progress-bar" style="width: ${(goal.current / goal.target) * 100}%"></div></div>
    `;
    goalsList.appendChild(li);
  });

  // Transaction history
  const txBody = document.getElementById("transactions-body");
  txBody.innerHTML = "";
  data.transactions.slice().reverse().forEach(tx => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.type === "add" ? "Tambah" : "Tarik"}</td>
      <td>${tx.asset}</td>
      <td>${formatIDR(tx.amount)}</td>
    `;
    txBody.appendChild(tr);
  });

  // Attach event listener for deleting goals
  document.querySelectorAll(".btn-delete-goal").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      try {
        const res = await fetch(`${API_BASE}/goal/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (res.ok) {
          showToast("Goal berhasil dihapus");
          updateUI();
        } else {
          showToast(json.error || "Gagal menghapus goal");
        }
      } catch {
        showToast("Error saat menghapus goal");
      }
    };
  });
}

async function addTransaction(type, asset, amount, token = null) {
  if (!amount || amount <= 0) {
    showToast("Masukkan nominal yang valid");
    return;
  }

  if (asset === "crypto" && (!token || token.trim() === "")) {
    showToast("Masukkan token crypto yang valid");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, asset, amount, token })
    });
    const json = await res.json();
    if (res.ok) {
      showToast(json.message);
      updateUI();
      clearInputs();
    } else {
      showToast(json.error || "Gagal melakukan transaksi");
    }
  } catch {
    showToast("Gagal menghubungi server");
  }
}

function clearInputs() {
  document.getElementById("cash-input").value = "";
  document.getElementById("atm-input").value = "";
  document.getElementById("crypto-token-input").value = "";
  document.getElementById("crypto-amount-input").value = "";
}

async function addGoal(name, target) {
  if (!name || !target || target <= 0) {
    showToast("Isi data goal dengan benar");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, target })
    });
    const json = await res.json();
    if (res.ok) {
      showToast(json.message);
      updateUI();
      document.getElementById("goal-form").reset();
    } else {
      showToast(json.error || "Gagal menambah goal");
    }
  } catch {
    showToast("Gagal menghubungi server");
  }
}

// Event listeners
document.getElementById("cash-add-btn").onclick = () => {
  const amount = parseInt(document.getElementById("cash-input").value.replace(/\D/g, ""));
  addTransaction("add", "cash", amount);
};

document.getElementById("cash-withdraw-btn").onclick = () => {
  const amount = parseInt(document.getElementById("cash-input").value.replace(/\D/g, ""));
  addTransaction("withdraw", "cash", amount);
};

document.getElementById("atm-add-btn").onclick = () => {
  const amount = parseInt(document.getElementById("atm-input").value.replace(/\D/g, ""));
  addTransaction("add", "atm", amount);
};

document.getElementById("atm-withdraw-btn").onclick = () => {
  const amount = parseInt(document.getElementById("atm-input").value.replace(/\D/g, ""));
  addTransaction("withdraw", "atm", amount);
};

document.getElementById("crypto-add-btn").onclick = () => {
  const token = document.getElementById("crypto-token-input").value.trim().toUpperCase();
  const amount = parseInt(document.getElementById("crypto-amount-input").value.replace(/\D/g, ""));
  addTransaction("add", "crypto", amount, token);
};

document.getElementById("crypto-withdraw-btn").onclick = () => {
  const token = document.getElementById("crypto-token-input").value.trim().toUpperCase();
  const amount = parseInt(document.getElementById("crypto-amount-input").value.replace(/\D/g, ""));
  addTransaction("withdraw", "crypto", amount, token);
};

document.getElementById("goal-form").onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("goal-name").value.trim();
  const target = parseInt(document.getElementById("goal-target").value);
  addGoal(name, target);
};

// Format input dengan Cleave.js (IDR format)
new Cleave("#cash-input", {
  numeral: true,
  numeralThousandsGroupStyle: 'thousand',
  prefix: 'Rp ',
  rawValueTrimPrefix: true
});
new Cleave("#atm-input", {
  numeral: true,
  numeralThousandsGroupStyle: 'thousand',
  prefix: 'Rp ',
  rawValueTrimPrefix: true
});
new Cleave("#crypto-amount-input", {
  numeral: true,
  numeralThousandsGroupStyle: 'thousand',
  prefix: 'Rp ',
  rawValueTrimPrefix: true
});

// Load UI awal
updateUI();

function fetchNotifications() {
  fetch("/api/notifications")
    .then(res => res.json())
    .then(notifs => {
      notifs.forEach(msg => {
        let type = "success"; // default success
        if (msg.includes("⚠️")) type = "error";
        showToast(msg, type);
      });
    });
}
