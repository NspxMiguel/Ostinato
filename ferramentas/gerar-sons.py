#!/usr/bin/env python3
"""Synthesises the app's alarm sounds.

iOS ringtones (Radar, Beacon, Chimes...) ship inside /System/Library and belong
to Apple: an app may not copy or bundle them, and doing so fails review. So the
app carries its own set, and this script is what makes it — the .caf files are a
build product, not a mystery binary someone dropped in the repo.

Each sound is a short loop: AlarmKit repeats it for as long as the alarm rings,
so the tail has to meet the head without a click.

    python3 ferramentas/gerar-sons.py
"""

import array
import math
import os
import struct
import subprocess
import wave

RATE = 44100
SAIDA = os.path.join(os.path.dirname(__file__), '..', 'mobile', 'assets')


def tom(buf, inicio, dur, freq, vol=0.5, decaimento=6.0, harmonicos=(1.0, 0.35, 0.12)):
    """One struck note: sine plus a couple of harmonics under a decaying envelope."""
    n0 = int(inicio * RATE)
    for i in range(int(dur * RATE)):
        if n0 + i >= len(buf):
            break
        t = i / RATE
        env = math.exp(-decaimento * t)
        v = sum(g * math.sin(2 * math.pi * freq * (k + 1) * t) for k, g in enumerate(harmonicos))
        buf[n0 + i] += vol * env * v


def varredura(buf, inicio, dur, f0, f1, vol=0.4):
    """A rising sweep — the shape a radar-style tone has."""
    n0 = int(inicio * RATE)
    fase = 0.0
    for i in range(int(dur * RATE)):
        if n0 + i >= len(buf):
            break
        t = i / RATE
        f = f0 + (f1 - f0) * (t / dur)
        fase += 2 * math.pi * f / RATE
        # Fades in and out so the loop point is silent.
        env = math.sin(math.pi * t / dur) ** 2
        buf[n0 + i] += vol * env * math.sin(fase)


# The Apple ceiling for a notification sound is 30s. A notification plays the
# file ONCE — a 5s loop would stop before anyone woke up — so the short pattern
# is repeated up to the ceiling, and AlarmKit loops the whole thing anyway.
TETO = 29.0


def repetir_ate_o_teto(buf):
    ciclo = len(buf)
    alvo = int(TETO * RATE)
    saida = []
    while len(saida) < alvo:
        saida.extend(buf[: min(ciclo, alvo - len(saida))])
    return saida


def escrever(nome, buf):
    buf = repetir_ate_o_teto(buf)
    pico = max(1e-9, max(abs(v) for v in buf))
    ganho = 0.89 / pico  # headroom, so conversion never clips
    quadros = array.array('h', (int(max(-32767, min(32767, v * ganho * 32767))) for v in buf))
    wav = os.path.join(SAIDA, nome + '.wav')
    caf = os.path.join(SAIDA, nome + '.caf')
    with wave.open(wav, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(quadros.tobytes())
    # CAF/IMA4 — the format the existing bell already uses, and a quarter of
    # the bytes of raw PCM.
    subprocess.run(['afconvert', '-f', 'caff', '-d', 'ima4@44100', wav, caf], check=True)
    os.remove(wav)
    print('  %-28s %5.1fs' % (nome + '.caf', len(buf) / RATE))


def vazio(segundos):
    return [0.0] * int(segundos * RATE)


# The set. Each entry is (file name, builder).
def marimba(b):
    notas = [523.25, 659.25, 783.99, 1046.50]
    for c in range(3):
        for i, f in enumerate(notas):
            tom(b, c * 1.6 + i * 0.16, 0.9, f, vol=0.5, decaimento=9.0)


def pulso(b):
    for c in range(10):
        tom(b, c * 0.45, 0.4, 220.0, vol=0.6, decaimento=14.0, harmonicos=(1.0, 0.5, 0.3))
        tom(b, c * 0.45, 0.4, 330.0, vol=0.3, decaimento=16.0)


def radar(b):
    for c in range(5):
        varredura(b, c * 0.9, 0.7, 440.0, 1320.0, vol=0.5)


def harpa(b):
    notas = [392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51]
    for c in range(3):
        for i, f in enumerate(notas):
            tom(b, c * 1.5 + i * 0.11, 1.6, f, vol=0.34, decaimento=3.2,
                harmonicos=(1.0, 0.22, 0.08))


def sonar(b):
    for c in range(4):
        tom(b, c * 1.2, 1.1, 880.0, vol=0.55, decaimento=4.0, harmonicos=(1.0, 0.15))
        tom(b, c * 1.2 + 0.28, 0.8, 880.0, vol=0.18, decaimento=5.0, harmonicos=(1.0, 0.15))


def carrilhao(b):
    notas = [659.25, 523.25, 587.33, 392.00]
    for c in range(2):
        for i, f in enumerate(notas):
            tom(b, c * 2.4 + i * 0.5, 2.0, f, vol=0.45, decaimento=2.4,
                harmonicos=(1.0, 0.4, 0.18, 0.07))


def farol(b):
    for c in range(8):
        f = 784.0 if c % 2 == 0 else 1046.5
        tom(b, c * 0.55, 0.34, f, vol=0.5, decaimento=11.0, harmonicos=(1.0, 0.6, 0.25))


CONJUNTO = [
    ('ostinato-marimba', 5.0, marimba),
    ('ostinato-pulso', 4.6, pulso),
    ('ostinato-radar', 4.6, radar),
    ('ostinato-harpa', 5.2, harpa),
    ('ostinato-sonar', 5.0, sonar),
    ('ostinato-carrilhao', 5.4, carrilhao),
    ('ostinato-farol', 4.6, farol),
]

if __name__ == '__main__':
    print('sons do alarme ->', os.path.normpath(SAIDA))
    for nome, dur, construir in CONJUNTO:
        b = vazio(dur)
        construir(b)
        escrever(nome, b)
