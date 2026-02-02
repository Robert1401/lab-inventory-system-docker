// --- JS mínimo para interacciones ---
const aprobar = document.getElementById('aprobar');
const rechazar = document.getElementById('rechazar');
const tabla = document.getElementById('tabla-materiales').querySelector('tbody');

if (aprobar) {
  aprobar.addEventListener('click', () => {
    const materia = document.getElementById('materia').value.trim();
    alert(`Solicitud APROBADA${materia ? `\nMateria: ${materia}` : ''}`);
  });
}

if (rechazar) {
  rechazar.addEventListener('click', () => {
    const motivo = prompt('Escribe el motivo del rechazo:');
    if (motivo !== null) {
      alert('Solicitud RECHAZADA\nMotivo: ' + (motivo || '(sin especificar)'));
    }
  });
}

// Doble clic para agregar una nueva fila editable
if (tabla) {
  tabla.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'TD') {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td contenteditable="true"></td>
        <td contenteditable="true"></td>
        <td contenteditable="true"></td>
      `;
      tabla.appendChild(tr);
    }
  });
}

// Iconos (si quieres comportamiento adicional, aquí)
const btnBack = document.querySelector('a.icono[title="Regresar"]');
const btnHome = document.querySelector('a.icono[title="Inicio"]');

if (btnBack) {
  btnBack.addEventListener('click', (e) => {
    // quita esto si SÍ quieres navegar al href
    // e.preventDefault();
    // history.back();
  });
}

if (btnHome) {
  btnHome.addEventListener('click', (e) => {
    // quita esto si SÍ quieres navegar al href
    // e.preventDefault();
    // window.location.href = '../../Login/index.html';
  });
}
