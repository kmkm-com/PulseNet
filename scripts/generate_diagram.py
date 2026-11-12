from PIL import Image, ImageDraw, ImageFont
import os

width = 960
height = 540

# Create image with warm archival cotton / blueprint slate backdrop
img = Image.new('RGB', (width, height), color='#0f172a')
draw = ImageDraw.Draw(img)

# Draw subtle grid lines
for x in range(0, width, 40):
    draw.line([(x, 0), (x, height)], fill='#1e293b', width=1)
for y in range(0, height, 40):
    draw.line([(0, y), (width, y)], fill='#1e293b', width=1)

# Header banner
draw.rectangle([(40, 36), (920, 96)], fill='#1e293b', outline='#334155', width=1)
draw.text((60, 48), "PULSENET SYSTEMS RESEARCH LAB  |  DISPATCH ARCHITECTURE BENCHMARK", fill='#38bdf8')
draw.text((60, 68), "PostgreSQL 17: Zero-Copy WAL Ring Buffer & Direct NVMe I/O Pipeline", fill='#f8fafc')

# Box 1: In-Memory Engine
draw.rectangle([(60, 130), (300, 310)], fill='#1e293b', outline='#475569', width=2)
draw.rectangle([(60, 130), (300, 165)], fill='#0284c7')
draw.text((75, 140), "1. BUFFER POOL (8KB)", fill='#ffffff')
draw.text((75, 185), "> Shared Buffer Cache", fill='#e2e8f0')
draw.text((75, 215), "> ClockSweep Eviction", fill='#94a3b8')
draw.text((75, 245), "> Dirty Page Queue", fill='#94a3b8')
draw.text((75, 275), "> Atomic Sequence LSN", fill='#38bdf8')

# Arrow 1
draw.line([(300, 220), (360, 220)], fill='#38bdf8', width=3)
draw.polygon([(360, 220), (350, 214), (350, 226)], fill='#38bdf8')

# Box 2: WAL Ring Buffer
draw.rectangle([(370, 130), (610, 310)], fill='#1e293b', outline='#06b6d4', width=2)
draw.rectangle([(370, 130), (610, 165)], fill='#0891b2')
draw.text((385, 140), "2. WAL RING BUFFER", fill='#ffffff')
draw.text((385, 185), "> Lockless Ring Buffer", fill='#e2e8f0')
draw.text((385, 215), "> Parallel LZ4 Compression", fill='#22c55e')
draw.text((385, 245), "> Multi-Threaded Sync", fill='#94a3b8')
draw.text((385, 275), "> Checkpoint Coordinator", fill='#38bdf8')

# Arrow 2
draw.line([(610, 220), (670, 220)], fill='#38bdf8', width=3)
draw.polygon([(670, 220), (660, 214), (660, 226)], fill='#38bdf8')

# Box 3: Persistent Storage
draw.rectangle([(680, 130), (900, 310)], fill='#1e293b', outline='#475569', width=2)
draw.rectangle([(680, 130), (900, 165)], fill='#4f46e5')
draw.text((695, 140), "3. NVMe DIRECT I/O", fill='#ffffff')
draw.text((695, 185), "> Linux io_uring Async", fill='#e2e8f0')
draw.text((695, 215), "> Direct I/O (O_DIRECT)", fill='#e2e8f0')
draw.text((695, 245), "> Strict fsync Durability", fill='#22c55e')
draw.text((695, 275), "> NVMe Gen5 Striped Array", fill='#a855f7')

# Metrics panel at the bottom
draw.rectangle([(60, 350), (900, 480)], fill='#182234', outline='#334155', width=1)
draw.text((80, 365), "BENCHMARK PERFORMANCE METRICS (1,000,000 TRANSACTIONS)", fill='#94a3b8')

draw.text((80, 400), "Throughput:", fill='#94a3b8')
draw.text((80, 425), "124,580 TPS", fill='#22c55e')

draw.text((280, 400), "Write Amplification:", fill='#94a3b8')
draw.text((280, 425), "1.18x Factor", fill='#38bdf8')

draw.text((490, 400), "Commit Latency (p99):", fill='#94a3b8')
draw.text((490, 425), "0.41 ms", fill='#22c55e')

draw.text((700, 400), "Durability Mode:", fill='#94a3b8')
draw.text((700, 425), "ACID Strict (fsync)", fill='#f59e0b')

out_path = os.path.join(os.path.dirname(__file__), 'postgres_wal_architecture.png')
img.save(out_path, format='PNG')
print(f"Generated diagram successfully at: {out_path}")
