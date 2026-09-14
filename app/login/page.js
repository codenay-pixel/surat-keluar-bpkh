'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HalamanLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lihatSandi, setLihatSandi] = useState(false);
  const [pesan, setPesan] = useState('');
  const [memuat, setMemuat] = useState(false);

  async function login() {
    const emailBersih = email.trim();
    if (!emailBersih || !password) {
      setPesan('Email dan password wajib diisi.');
      return;
    }

    setMemuat(true);
    setPesan('Memeriksa akun...');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailBersih, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setMemuat(false);
        setPesan(data.error || 'Email atau password salah.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setMemuat(false);
      setPesan('Tidak bisa menghubungi server. Coba lagi.');
    }
  }

  function keydown(e) {
    if (e.key === 'Enter') login();
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-bpkh.jpg"
            alt="Logo BPKH"
          />
        </div>

        <h2 className="login-title">Sistem Manajemen Surat Keluar</h2>
        <p className="login-welcome">BPKH Wilayah I</p>
        <p className="login-subtitle">Silakan masuk sebagai admin untuk melanjutkan</p>

        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          placeholder="Masukkan email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={keydown}
        />

        <label htmlFor="password">Password</label>
        <div className="kotak-sandi">
          <input
            type={lihatSandi ? 'text' : 'password'}
            id="password"
            placeholder="Masukkan password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={keydown}
          />
          <button
            type="button"
            className={'mata-sandi' + (lihatSandi ? ' aktif' : '')}
            onClick={() => setLihatSandi(!lihatSandi)}
            title={lihatSandi ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-label={lihatSandi ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {lihatSandi ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>

        <button type="button" disabled={memuat} onClick={login}>Masuk</button>

        <p id="pesan">{pesan}</p>
      </div>
    </div>
  );
}
