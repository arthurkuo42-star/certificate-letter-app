const form = document.querySelector("#letterForm");
const preview = document.querySelector("#preview");
const stats = document.querySelector("#stats");
const recipientsRoot = document.querySelector("#recipients");
const recipientTemplate = document.querySelector("#recipientTemplate");

const STORAGE_KEY = "certificate-letter-draft-v2";
const ROWS_PER_PAGE = 10;
const COLS_PER_ROW = 20;
const CHARS_PER_PAGE = ROWS_PER_PAGE * COLS_PER_ROW;
const numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function toFullWidth(text) {
  return text.replace(/[!-~]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0)).replace(/ /g, "　");
}

function normalizeContent(text, shouldConvert) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  return shouldConvert ? toFullWidth(joined) : joined;
}

function collectRecipients() {
  return Array.from(recipientsRoot.querySelectorAll(".person-card")).map((card) => ({
    name: card.querySelector('[data-field="name"]').value.trim(),
    address: card.querySelector('[data-field="address"]').value.trim()
  }));
}

function addRecipient(recipient = {}) {
  const index = recipientsRoot.children.length + 1;
  const node = recipientTemplate.content.cloneNode(true);
  const card = node.querySelector(".person-card");
  card.querySelector("h3").textContent = `收件人 ${index}`;
  card.querySelector('[data-field="name"]').value = recipient.name || "";
  card.querySelector('[data-field="address"]').value = recipient.address || "";
  card.querySelector(".remove-recipient").hidden = index === 1;
  recipientsRoot.appendChild(node);
  renumberRecipients();
}

function renumberRecipients() {
  const cards = Array.from(recipientsRoot.querySelectorAll(".person-card"));
  cards.forEach((card, index) => {
    card.querySelector("h3").textContent = `收件人 ${index + 1}`;
    card.querySelector(".remove-recipient").hidden = index === 0;
  });
}

function formValues() {
  return {
    senderName: form.elements.senderName.value.trim(),
    senderAddress: form.elements.senderAddress.value.trim(),
    recipients: collectRecipients(),
    ccName: form.elements.ccName.value.trim(),
    ccAddress: form.elements.ccAddress.value.trim(),
    body: form.elements.body.value,
    autoFullWidth: form.elements.autoFullWidth.checked
  };
}

function setValues(data) {
  form.elements.senderName.value = data.senderName || "";
  form.elements.senderAddress.value = data.senderAddress || "";
  form.elements.ccName.value = data.ccName || "";
  form.elements.ccAddress.value = data.ccAddress || "";
  form.elements.body.value = data.body || "";
  form.elements.autoFullWidth.checked = data.autoFullWidth !== false;
  recipientsRoot.innerHTML = "";
  const recipients = Array.isArray(data.recipients) && data.recipients.length ? data.recipients : [{}];
  recipients.forEach(addRecipient);
}

function buildLetterText(data) {
  return normalizeContent(data.body || "", data.autoFullWidth);
}

function splitIntoPages(text) {
  const pages = [];
  let current = "";
  for (const char of text) {
    if (char === "\n") {
      const remainder = current.length % COLS_PER_ROW;
      if (remainder !== 0) current += "　".repeat(COLS_PER_ROW - remainder);
      continue;
    }
    current += char;
  }
  for (let i = 0; i < Math.max(current.length, 1); i += CHARS_PER_PAGE) {
    pages.push(current.slice(i, i + CHARS_PER_PAGE));
  }
  return pages;
}

function safeText(value) {
  return value && value.trim() ? value.trim() : "　　　　";
}

function officialHeader(data) {
  const firstRecipient = data.recipients[0] || {};
  const secondRecipient = data.recipients[1] || {};
  const thirdName = data.ccName || secondRecipient.name || "";
  const thirdAddress = data.ccAddress || secondRecipient.address || "";
  return `
    <header class="official-header">
      <h2 class="official-title">郵　局　存　證　信　函　用　紙</h2>
      <div class="top-form">
        <div class="copy-mark">副　正<br>本</div>
        <div class="post-office-block">
          <div class="post-office-word">郵　局</div>
          <div class="letter-number">存證信函第　　　　號</div>
        </div>
        <div class="party-form">
          <p class="party-form-note">（寄件人如為機關、團體、學校、公司、商號請加蓋單位圖章及法定代理人簽名或蓋章）</p>
          <span class="stamp-box">印</span>
          <div class="party-form-grid">
            <div class="party-entry">
              <div class="party-label">一、寄件人</div>
              <div class="party-lines">
                <div>姓名：${safeText(data.senderName)}</div>
                <div>詳細地址：${safeText(data.senderAddress)}</div>
              </div>
            </div>
            <div class="party-entry">
              <div class="party-label">二、收件人</div>
              <div class="party-lines">
                <div>姓名：${safeText(firstRecipient.name)}</div>
                <div>詳細地址：${safeText(firstRecipient.address)}</div>
              </div>
            </div>
            <div class="party-entry third-party-entry">
              <div class="side-note">副　本</div>
              <div class="party-label">三、收件人</div>
              <div class="party-lines">
                <div>姓名：${safeText(thirdName)}</div>
                <div>詳細地址：${safeText(thirdAddress)}</div>
              </div>
            </div>
          </div>
          <p class="party-form-foot">（本欄姓名、地址不敷填寫時，請另紙聯記）</p>
        </div>
      </div>
    </header>
  `;
}

function renderGrid(pageText) {
  const headers = Array.from({ length: COLS_PER_ROW }, (_, index) => `<td>${index + 1}</td>`).join("");
  let body = "";
  for (let row = 0; row < ROWS_PER_PAGE; row += 1) {
    const cells = [];
    for (let col = 0; col < COLS_PER_ROW; col += 1) {
      const char = pageText[row * COLS_PER_ROW + col] || "";
      cells.push(`<td>${char}</td>`);
    }
    body += `<tr><th>${numerals[row]}</th>${cells.join("")}</tr>`;
  }
  return `
    <table class="body-grid">
      <thead><tr><th>格<br>行</th>${headers}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function officialBottom() {
  return `
    <section class="bottom-form">
      <div class="calculation-box">
        <div class="fee-lines">
          <div>本存證信函共　　　　　頁，正本　　　　　份，存證費　　　　　元，</div>
          <div>　　　　　　　　　　　副本　　　　　份，存證費　　　　　元，</div>
          <div>　　　　　　　　　　　附件　　　　　張，存證費　　　　　元，</div>
          <div>　　　　　　　　　　　加具正本　　　份，存證費　　　　　元，</div>
          <div>　　　　　　　　　　　加具副本　　　份，存證費　　　　　元，合計　　　　　元。</div>
        </div>
        <div class="cert-line">
          <span>經　　　郵局</span>
          <span>年　　月　　日證明正副本內容完全相同</span>
          <span class="round-stamp">郵戳</span>
          <span>經辦員<br>主管</span>
          <span class="small-stamp">印</span>
        </div>
      </div>
      <div class="stamp-column">
        <div>黏</div>
        <div>貼</div>
        <div>郵　票　或<br>郵　資　券</div>
        <div>處</div>
      </div>
      <div class="note-box">
        <div class="note-title">備<br>註</div>
        <div class="note-content">
          <p>一、存證信函需送交郵局辦理證明手續後始有效，自交寄之日起由郵局保存之副本，於三年期滿後銷燬之。</p>
          <p>二、在　　頁　　行第　　格下　　字　　　　用印，如有修改應填註本欄並蓋用寄件人印章，但塗改增刪每頁至多不得逾二十字。</p>
          <p>三、每件一式三份，用不脫色筆或打字機複寫，或書寫後複印、影印，每格限書一字，色澤明顯，字跡端正。</p>
        </div>
      </div>
      <div class="riding-stamps">
        <span>騎縫郵戳</span>
        <span>騎縫郵戳</span>
      </div>
    </section>
  `;
}

function templateOverlay(data) {
  const firstRecipient = data.recipients[0] || {};
  const secondRecipient = data.recipients[1] || {};
  const thirdName = data.ccName || secondRecipient.name || "";
  const thirdAddress = data.ccAddress || secondRecipient.address || "";
  return `
    <div class="party-overlay">
      <div class="template-field sender-name">${safeText(data.senderName)}</div>
      <div class="template-field sender-address">${safeText(data.senderAddress)}</div>
      <div class="template-field recipient-name">${safeText(firstRecipient.name)}</div>
      <div class="template-field recipient-address">${safeText(firstRecipient.address)}</div>
      <div class="template-field third-name">${safeText(thirdName)}</div>
      <div class="template-field third-address">${safeText(thirdAddress)}</div>
    </div>
  `;
}

function renderPage(data, pageText) {
  return `
    <article class="sheet template-sheet">
      <img class="template-bg" src="reference/blank-render/page-1.png" alt="">
      ${templateOverlay(data)}
      ${renderGrid(pageText)}
    </article>
  `;
}

function render() {
  const data = formValues();
  const letterText = buildLetterText(data);
  const pages = splitIntoPages(letterText);
  preview.innerHTML = pages.map((page) => renderPage(data, page)).join("");
  stats.textContent = `目前共 ${pages.length} 頁。`;
}

form.addEventListener("input", render);
recipientsRoot.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-recipient")) return;
  event.target.closest(".person-card").remove();
  renumberRecipients();
  render();
});
document.querySelector("#addRecipient").addEventListener("click", () => {
  addRecipient();
  render();
});
document.querySelector("#printPdf").addEventListener("click", () => window.print());
document.querySelector("#saveDraft").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues()));
});
document.querySelector("#loadDraft").addEventListener("click", () => {
  const draft = localStorage.getItem(STORAGE_KEY);
  if (draft) {
    setValues(JSON.parse(draft));
    render();
  }
});
document.querySelector("#clearDraft").addEventListener("click", () => {
  setValues({});
  render();
});

setValues({});
render();
