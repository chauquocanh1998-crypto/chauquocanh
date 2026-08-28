import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ĐIỀN THÔNG TIN FIREBASE CỦA BẠN VÀO ĐÂY
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "chauquocanh.firebaseapp.com",
  projectId: "chauquocanh",
  storageBucket: "chauquocanh.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = { name: "", role: "" };
let materialsList = [];
let html5QrcodeScanner = null;

// Tự động điền ngày hiện tại
document.getElementById('auditDate').valueAsDate = new Date();

// 1. XỬ LÝ ĐĂNG NHẬP
window.login = () => {
    const role = document.getElementById('loginRole').value;
    if (role === 'admin') {
        const u = document.getElementById('adminUser').value;
        const p = document.getElementById('adminPass').value;
        if (u === 'admin' && p === 'chauquocanh') {
            currentUser = { name: 'Admin', role: 'admin' };
        } else {
            alert('Sai tên đăng nhập hoặc mật khẩu Admin!');
            return;
        }
    } else {
        const gName = document.getElementById('guestName').value.trim();
        if (!gName) {
            alert('Vui lòng nhập tên người kiểm kê!');
            return;
        }
        currentUser = { name: gName, role: 'guest' };
    }

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');
    document.getElementById('userInfo').innerText = currentUser.name;
    document.getElementById('userRole').innerText = currentUser.role === 'admin' ? 'Quản trị viên' : 'Khách';

    if (currentUser.role === 'admin') {
        document.getElementById('adminPanel').classList.remove('hidden');
    }
    
    loadMaterials();
    loadHistory();
};

window.logout = () => {
    location.reload();
};

// 2. QUẢN LÝ DANH MỤC (ADMIN)
window.addMaterial = async () => {
    const group = document.getElementById('matGroup').value.trim();
    const code = document.getElementById('matCode').value.trim();
    const name = document.getElementById('matName').value.trim();
    const qr = document.getElementById('matQR').value.trim();

    if (!code || !name || !qr) {
        alert('Vui lòng điền đủ Mã, Tên và Mã QR!');
        return;
    }

    await addDoc(collection(db, "materials"), { group, code, name, qr });
    alert('Thêm vật tư thành công!');
    document.getElementById('matCode').value = '';
    document.getElementById('matName').value = '';
    document.getElementById('matQR').value = '';
};

function loadMaterials() {
    onSnapshot(collection(db, "materials"), (snapshot) => {
        const select = document.getElementById('selectMaterial');
        select.innerHTML = '<option value="">-- Chọn Material / Vật tư --</option>';
        materialsList = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            materialsList.push(data);
            select.innerHTML += `<option value="${data.qr}">[${data.group || 'Khác'}] ${data.code} - ${data.name}</option>`;
        });
    });
}

// 3. QUÉT MÃ QR
window.startScanner = () => {
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        (decodedText) => {
            // Khi quét thành công mã QR
            const mat = materialsList.find(m => m.qr === decodedText);
            if (mat) {
                document.getElementById('selectMaterial').value = mat.qr;
                alert(`Đã tìm thấy: ${mat.name}`);
            } else {
                alert(`Mã QR "${decodedText}" chưa có trong danh mục!`);
            }
            html5QrcodeScanner.stop();
        },
        (errorMessage) => {}
    );
};

// 4. LƯU KẾT QUẢ KIỂM KÊ
window.submitAudit = async () => {
    const date = document.getElementById('auditDate').value;
    const qrVal = document.getElementById('selectMaterial').value;
    const qty = document.getElementById('auditQty').value;

    if (!date || !currentUser.name) {
        alert('Bắt buộc phải có Tên người kiểm kê và Ngày!');
        return;
    }
    if (!qrVal || !qty) {
        alert('Vui lòng chọn vật tư và nhập số lượng!');
        return;
    }

    const mat = materialsList.find(m => m.qr === qrVal);

    await addDoc(collection(db, "audit_history"), {
        date: date,
        inspector: currentUser.name,
        materialGroup: mat ? mat.group : "",
        materialCode: mat ? mat.code : "",
        materialName: mat ? mat.name : "",
        qty: Number(qty),
        timestamp: new Date()
    });

    alert('Đã lưu dữ liệu kiểm kê!');
    document.getElementById('auditQty').value = '';
};

// 5. HIỂN THỊ LỊCH SỬ
function loadHistory() {
    const q = query(collection(db, "audit_history"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('historyTable');
        tbody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${data.date}</td>
                    <td>${data.inspector}</td>
                    <td>${data.materialName} (${data.materialCode})</td>
                    <td><b>${data.qty}</b></td>
                </tr>
            `;
        });
    });
}

// 6. XUẤT EXCEL
window.exportToExcel = () => {
    const table = document.getElementById("historyTable");
    const rows = table.getElementsByTagName("tr");
    
    if (rows.length === 0) {
        alert("Chưa có dữ liệu lịch sử để xuất file!");
        return;
    }

    const data = [];
    for (let row of rows) {
        const cols = row.querySelectorAll("td");
        data.push({
            "Ngày kiểm kê": cols[0].innerText,
            "Người kiểm kê": cols[1].innerText,
            "Vật tư / Mã": cols[2].innerText,
            "Số lượng": Number(cols[3].innerText)
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lich_Su_Kiem_Ke");
    XLSX.writeFile(workbook, `KiemKe_${new Date().toISOString().split('T')[0]}.xlsx`);
};
