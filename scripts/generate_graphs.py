# File: scripts/generate_graphs.py
# Purpose: Generate voucher usage and revenue trend graphs for weekly email attachments

import json
import os
import matplotlib.pyplot as plt
from datetime import datetime

data_path = os.path.join(os.path.dirname(__file__), '../data/dailyReports.json')
graph_dir = os.path.join(os.path.dirname(__file__), '../data/graphs')
os.makedirs(graph_dir, exist_ok=True)

with open(data_path, 'r') as f:
    reports = json.load(f)

# Use last 7 days
last_week = reports[-7:]

dates = [datetime.fromisoformat(r['date']).strftime('%a') for r in last_week]
vouchers = [r['stats']['total'] for r in last_week]
revenue = [r['payments']['revenue'] for r in last_week]

# Voucher trend
plt.figure(figsize=(8,4))
plt.plot(dates, vouchers, marker='o', color='blue')
plt.title("Voucher Usage Trend (Last 7 Days)")
plt.xlabel("Day")
plt.ylabel("Total Vouchers")
plt.grid(True)
plt.savefig(os.path.join(graph_dir, 'voucher_trend.png'))
plt.close()

# Revenue trend
plt.figure(figsize=(8,4))
plt.plot(dates, revenue, marker='o', color='green')
plt.title("Revenue Trend (Last 7 Days)")
plt.xlabel("Day")
plt.ylabel("Revenue (FCFA)")
plt.grid(True)
plt.savefig(os.path.join(graph_dir, 'revenue_trend.png'))
plt.close()

