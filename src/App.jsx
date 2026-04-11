import React, { useState, useEffect } from 'react';
import './App.css';

const PLACEHOLDER = "https://cdn-icons-png.freepik.com/512/8136/8136031.png";

const OMDB_KEY = "7738120f"; 
const LASTFM_KEY = "83dc429fbca9842136469ec0c1032d43"; 
const TWITCH_CLIENT_ID = "ajl9pi1t41y97d24j3msso8yqswyt7";
const TWITCH_CLIENT_SECRET = "s8crl31cflmlttbx6f1lfnb3rrvdan";

function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [authMode, setAuthMode] = useState('login'); 
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  // --- ESTADOS ORIGINALES ---
  const [sector, setSector] = useState('movies');
  const [items, setItems] = useState([]); 
  const [filtros, setFiltros] = useState({ texto: '', categoria: 'Todas' });
  const [seleccionada, setSeleccionada] = useState(null);
  
  const [title, setTitle] = useState('');
  const [autor, setAutor] = useState(''); 
  const [status, setStatus] = useState('Pendiente');
  const [comments, setComments] = useState('');
  const [description, setDescription] = useState('');
  const [idEditando, setIdEditando] = useState(null);
  
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [datosAuto, setDatosAuto] = useState(null);

  const handleImgError = (e) => { e.target.src = PLACEHOLDER; };

  // --- LÓGICA DE LOGIN/REGISTRO ---
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? 'login' : 'register';
    try {
      // Usamos /api/auth solo para login y registro
      const res = await fetch(`https://mediavault-api.onrender.com/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (res.ok) {
        if (authMode === 'login') {
          const data = await res.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('username', data.username);
          setToken(data.token);
          setUsername(data.username);
        } else {
          alert("Registro completado. Ya puedes iniciar sesión.");
          setAuthMode('login');
        }
      } else {
        alert("Error en la autenticación. Revisa tus datos.");
      }
    } catch (err) {
      console.error("Detalle del error:", err);
      alert("Error al conectar con el servidor.");
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUsername(null);
  };

  const limpiarFormulario = () => {
    setTitle(''); setAutor(''); setStatus('Pendiente');
    setComments(''); setDescription(''); setIdEditando(null);
    setDatosAuto(null); setSugerencias([]); setMostrarSugerencias(false);
  };

  const cargarDatos = () => {
    if (!token) return;
    // Corregido: Las rutas de datos no llevan /auth/
    const endpoint = sector === 'movies' ? 'media' : sector === 'music' ? 'music' : 'games';
    
    fetch(`https://mediavault-api.onrender.com/api/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("No autorizado");
        return res.json();
      })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  };

  useEffect(() => { 
    cargarDatos(); 
  }, [sector, token]);

  useEffect(() => {
    if (title.length < 3) return;
    const delay = setTimeout(async () => {
      let url = "";
      if (sector === 'movies') {
        url = `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`;
      } else if (sector === 'music') {
        url = `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(title)}&api_key=${LASTFM_KEY}&format=json`;
      }
      try {
        if (sector === 'movies' || sector === 'music') {
          const res = await fetch(url);
          const data = await res.json();
          if (sector === 'movies' && data.Search) {
            setSugerencias(data.Search.slice(0, 5));
            setMostrarSugerencias(true);
          } else if (sector === 'music' && data.results?.albummatches?.album) {
            const discosNormalizados = data.results.albummatches.album.map(album => ({
              Title: album.name, Artist: album.artist,
              Poster: album.image[3]['#text'] || PLACEHOLDER, imdbID: album.url 
            }));
            setSugerencias(discosNormalizados.slice(0, 5));
            setMostrarSugerencias(true);
          }
        } 
        else if (sector === 'games') {
          const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
            method: 'POST'
          });
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          const proxyUrl = "https://cors-anywhere.herokuapp.com/";
          const targetUrl = "https://api.igdb.com/v4/games";
          const res = await fetch(proxyUrl + targetUrl, {
            method: 'POST',
            headers: {
              'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'text/plain'
            },
            body: `search "${title}"; fields name, cover.url, first_release_date, summary, involved_companies.company.name, involved_companies.developer; limit 5;`
          });
          const data = await res.json();
          if (data && data.length > 0) {
            const juegosNormalizados = data.map(game => {
              const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : "N/A";
              const coverUrl = game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : PLACEHOLDER;
              let desarrollador = "Estudio N/A";
              if (game.involved_companies) {
                const devCompany = game.involved_companies.find(ic => ic.developer === true);
                desarrollador = devCompany?.company?.name || game.involved_companies[0]?.company?.name || "Estudio N/A";
              }
              return { Title: game.name, Artist: desarrollador, Poster: coverUrl, imdbID: game.id.toString(), Year: year, Summary: game.summary || "" };
            });
            setSugerencias(juegosNormalizados);
            setMostrarSugerencias(true);
          }
        }
      } catch (error) { console.error("Error en la API:", error); }
    }, 500);
    return () => clearTimeout(delay);
  }, [title, sector]);

  const manejarCambioTitulo = (e) => {
    setTitle(e.target.value);
    if (e.target.value.length < 3) { setSugerencias([]); setMostrarSugerencias(false); }
  };

  const seleccionarSugerencia = async (sug) => {
    setTitle(sug.Title);
    setMostrarSugerencias(false);
    if (sector === 'movies') {
      const res = await fetch(`https://www.omdbapi.com/?i=${sug.imdbID}&plot=full&apikey=${OMDB_KEY}`);
      const data = await res.json();
      setAutor(data.Director || "N/A"); 
      setDescription(data.Plot || "");
      setDatosAuto({ poster: sug.Poster, year: parseInt(sug.Year) || 0 });
    } else if (sector === 'music') {
      setAutor(sug.Artist);
      setDescription(`Álbum de ${sug.Artist} obtenido de Last.fm.`); 
      setDatosAuto({ poster: sug.Poster, year: 0 });
    } else if (sector === 'games') {
      setAutor(sug.Artist); 
      setDescription(sug.Summary || "No hay sinopsis disponible para este juego."); 
      setDatosAuto({ poster: sug.Poster, year: sug.Year });
    }
  };

  const guardarElemento = (e) => {
    e.preventDefault();
    const endpoint = sector === 'movies' ? 'media' : sector === 'music' ? 'music' : 'games';
    let objetoGuardar = { title, status, comments };
    
    if (sector === 'movies') {
      Object.assign(objetoGuardar, { 
        director: autor, 
        imageUrl: datosAuto?.poster || PLACEHOLDER, 
        releaseYear: datosAuto?.year || 0, 
        synopsis: description, 
        type: "Película" 
      });
    } else if (sector === 'music') {
      Object.assign(objetoGuardar, { artist: autor, imageUrl: datosAuto?.poster || PLACEHOLDER, releaseYear: 0, description: description });
    } else if (sector === 'games') {
      Object.assign(objetoGuardar, { developer: autor, imageUrl: datosAuto?.poster || PLACEHOLDER, releaseYear: datosAuto?.year || 0, description: description });
    }

    // Corregido: La ruta de guardado no lleva /auth/
    const baseUrl = `https://mediavault-api.onrender.com/api/${endpoint}`;
    const url = idEditando ? `${baseUrl}/${idEditando}` : baseUrl;
    
    fetch(url, {
      method: idEditando ? 'PUT' : 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(objetoGuardar)
    }).then(() => { cargarDatos(); limpiarFormulario(); });
  };

  const borrarElemento = (id) => {
    const endpoint = sector === 'movies' ? 'media' : sector === 'music' ? 'music' : 'games';
    if (window.confirm("¿Estás seguro de que quieres borrarlo?")) {
      // Corregido: La ruta de borrar no lleva /auth/
      fetch(`https://mediavault-api.onrender.com/api/${endpoint}/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => cargarDatos());
    }
  };

  const cargarParaEditar = (item) => {
    setIdEditando(item.id); setTitle(item.title); setStatus(item.status); setComments(item.comments);
    setDescription(sector === 'movies' ? item.synopsis : item.description || "");
    setAutor(item.director || item.artist || item.developer);
    setDatosAuto({ poster: item.imageUrl, year: item.releaseYear });
  };

  if (!token) {
    return (
      <div className="app-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
        <div className="form-wrapper">
          <div className="glass-card">
            <h2>{authMode === 'login' ? "INICIAR SESIÓN" : "CREAR CUENTA"}</h2>
            <form onSubmit={handleAuth}>
              <div className="input-box">
                <label>Usuario:</label>
                <input type="text" required onChange={e => setCredentials({...credentials, username: e.target.value})} />
              </div>
              <div className="input-box">
                <label>Contraseña:</label>
                <input type="password" required onChange={e => setCredentials({...credentials, password: e.target.value})} />
              </div>
              <button type="submit" className="btn-save" style={{width: '100%'}}>
                {authMode === 'login' ? "ENTRAR" : "REGISTRARME"}
              </button>
            </form>
            <p style={{marginTop: '20px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold'}} 
               onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="navbar-main">
        <div className="nav-wrapper">
          <span className="logo-text">MEDIA<b>VAULT</b></span>
          <nav className="sector-tabs">
            <button className={sector === 'movies' ? 'tab active' : 'tab'} onClick={() => {setSector('movies'); limpiarFormulario();}}>🎬 CINE</button>
            <button className={sector === 'music' ? 'tab active' : 'tab'} onClick={() => {setSector('music'); limpiarFormulario();}}>🎸 MÚSICA</button>
            <button className={sector === 'games' ? 'tab active' : 'tab'} onClick={() => {setSector('games'); limpiarFormulario();}}>🎮 JUEGOS</button>
          </nav>
          <div className="nav-search" style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <span style={{color: 'white', fontWeight: 'bold'}}>Hi, {username}!</span>
            <button onClick={logout} style={{background: 'var(--red)', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', fontFamily: 'Bebas Neue'}}>LOGOUT</button>
          </div>
        </div>
      </header>

      <div className="filter-chips">
        {['Todas', 'Pendiente', 'En progreso', 'Terminado'].map(cat => (
          <div key={cat} className={`chip ${filtros.categoria === cat ? 'active' : ''}`} onClick={() => setFiltros({...filtros, categoria: cat})}>{cat}</div>
        ))}
      </div>

      <div className="form-wrapper">
        <div className="glass-card">
          <h2>{idEditando ? "✏️ Editando" : sector === 'movies' ? "➕ Añadir Película/Serie" : sector === 'music' ? "➕ Añadir Disco" : "➕ Añadir Juego"}</h2>
          <form onSubmit={guardarElemento}>
            <div className="input-box">
              <label>Título:</label>
              <input type="text" value={title} onChange={manejarCambioTitulo} required autoComplete="off" />
              {mostrarSugerencias && sugerencias.length > 0 && (
                <ul className="suggestions-list">
                  {sugerencias.map((sug) => (
                    <li key={sug.imdbID} className="suggestion-item" onClick={() => seleccionarSugerencia(sug)}>
                      <img src={sug.Poster} alt="p" className="suggestion-thumb" onError={handleImgError} />
                      <div><strong>{sug.Title}</strong><span>{sug.Year || sug.Artist}</span></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-row">
              <div className="input-box"><label>Estado:</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En progreso">{sector === 'movies' ? 'Viendo' : sector === 'music' ? 'Escuchando' : 'Jugando'}</option>
                  <option value="Terminado">Terminado</option>
                </select>
              </div>
              <div className="input-box"><label>Año</label><div className="display-data">{datosAuto?.year || "---"}</div></div>
            </div>
            <div className="input-box"><label>Comentarios:</label><textarea value={comments} onChange={(e) => setComments(e.target.value)} /></div>
            <div style={{display: 'flex', gap: '15px'}}>
              <button type="submit" className="btn-save">{idEditando ? 'Actualizar' : 'Guardar'}</button>
              {idEditando && <button type="button" className="btn-save" style={{background: '#aaa'}} onClick={limpiarFormulario}>Cancelar</button>}
            </div>
          </form>
        </div>
      </div>

      <div className="cards-grid">
        {items.filter(item => item.title?.toLowerCase().includes(filtros.texto.toLowerCase()) && (filtros.categoria === 'Todas' || item.status === filtros.categoria)).map(item => (
          <div className="movie-card" key={item.id} onClick={() => setSeleccionada(item)}>
            <div className="img-container">
              <img src={item.imageUrl || PLACEHOLDER} alt={item.title} onError={handleImgError} />
              <div className="card-btns">
                <button onClick={(e) => { e.stopPropagation(); cargarParaEditar(item); }}>✏️</button>
                <button onClick={(e) => { e.stopPropagation(); borrarElemento(item.id); }}>🗑️</button>
              </div>
            </div>
            <div className="info-container">
              <h4>{item.title}</h4>
              <div className="mini-tags">
                <span>{item.director || item.artist || item.developer || "N/A"}</span>
                <span style={{background: item.status === 'Terminado' ? '#27ae60' : item.status === 'En progreso' ? 'var(--accent)' : '#f39c12'}}>{item.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {seleccionada && (
        <div className="modal-overlay" onClick={() => setSeleccionada(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSeleccionada(null)}>×</button>
            <div className="modal-grid">
              <div className="modal-poster"><img src={seleccionada.imageUrl || PLACEHOLDER} alt="p" onError={handleImgError} /></div>
              <div className="modal-details">
                <h1>{seleccionada.title}</h1>
                <p><b>Creador:</b> {seleccionada.director || seleccionada.artist || seleccionada.developer}</p>
                <p>{seleccionada.synopsis || seleccionada.description || "Sin descripción."}</p>
                <div style={{marginTop: '20px', padding: '15px', background: '#eee', border: '3px dashed var(--dark)'}}>
                  <b>Tus notas:</b><p>{seleccionada.comments || "Sin comentarios."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="area-pie">
        <div className="contenido-footer">
          <div className="columna-footer"><h4>MEDIA<b>VAULT</b></h4><p>Tu portal favorito.</p></div>
          <div className="columna-footer"><h4>Contacto</h4><p>ayuda@mediavault.com</p></div>
          <div className="columna-footer"><h4>Legal</h4><p>© 2026 Todos los derechos reservados.</p></div>
        </div>
      </footer>
    </div>
  );
}

export default App;