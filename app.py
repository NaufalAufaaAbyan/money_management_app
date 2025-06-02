from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

data = {
    "cash": 0,
    "atm": 0,
    "crypto": {},
    "goals": [],
    "transactions": [],
    "notifications": []
}

def check_goals_and_balances():
    data["notifications"].clear()  # Reset notifikasi dulu

    # Cek goals tercapai
    for goal in data["goals"]:
        if goal["current"] >= goal["target"]:
            notif = f"🎉 Goal '{goal['name']}' telah tercapai!"
            if notif not in data["notifications"]:
                data["notifications"].append(notif)

    # Cek saldo cash dan atm kurang dari 40% target terkecil
    if data["goals"]:
        min_target = min(goal["target"] for goal in data["goals"])
        threshold = min_target * 0.4

        if data["cash"] < threshold:
            notif = f"⚠️ Saldo Cash Anda kurang dari 40% dari target goal terkecil!"
            if notif not in data["notifications"]:
                data["notifications"].append(notif)

        if data["atm"] < threshold:
            notif = f"⚠️ Saldo ATM Anda kurang dari 40% dari target goal terkecil!"
            if notif not in data["notifications"]:
                data["notifications"].append(notif)

def update_goals_current():
    total_cash_atm = data["cash"] + data["atm"]
    for goal in data["goals"]:
        goal["current"] = total_cash_atm
    check_goals_and_balances()

def save_transaction(tx_type, asset, amount, token=None):
    global data
    tx_id = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if asset == "crypto" and token:
        asset_key = token.lower()
        current = data["crypto"].get(asset_key, 0)
        if tx_type == "add":
            data["crypto"][asset_key] = current + amount
        else:
            # Withdraw crypto: subtract crypto, add to atm
            data["crypto"][asset_key] = max(0, current - amount)
            data["atm"] += amount
            if data["crypto"][asset_key] == 0:
                data["crypto"].pop(asset_key)
    else:
        # cash or atm
        if asset not in ["cash", "atm"]:
            return False, "Invalid asset"

        current = data[asset]
        if tx_type == "add":
            data[asset] = current + amount
        else:
            if amount > current:
                return False, f"Saldo {asset} tidak cukup"
            data[asset] = current - amount

    tx = {
        "id": tx_id,
        "date": now,
        "type": tx_type,
        "asset": asset if asset != "crypto" else f"crypto-{token.upper()}",
        "amount": amount
    }
    data["transactions"].append(tx)

    # Update goals current value after each transaction
    update_goals_current()

    return True, "Transaksi berhasil"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/data")
def get_data():
    return jsonify(data)

@app.route("/api/notifications")
def get_notifications():
    return jsonify(data["notifications"])

@app.route("/api/transaction", methods=["POST"])
def add_transaction():
    content = request.get_json()
    tx_type = content.get("type")
    asset = content.get("asset")
    amount = content.get("amount")
    token = content.get("token")

    # Validasi input
    if tx_type not in ("add", "withdraw"):
        return jsonify({"error": "Invalid transaction type"}), 400

    if asset not in ("cash", "atm", "crypto"):
        return jsonify({"error": "Invalid asset"}), 400

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "Amount must be positive integer"}), 400

    if asset == "crypto" and (not token or not isinstance(token, str)):
        return jsonify({"error": "Crypto token required"}), 400

    success, message = save_transaction(tx_type, asset, amount, token)
    if not success:
        return jsonify({"error": message}), 400

    return jsonify({"message": message})

@app.route("/api/goal", methods=["POST"])
def add_goal():
    content = request.get_json()
    name = content.get("name")
    target = content.get("target")

    if not name or not isinstance(target, int) or target <= 0:
        return jsonify({"error": "Invalid goal data"}), 400

    new_goal = {
        "id": str(uuid.uuid4()),
        "name": name,
        "target": target,
        "current": data["cash"] + data["atm"]  # Set current saat goal dibuat
    }
    data["goals"].append(new_goal)
    return jsonify({"message": "Goal added"})

@app.route("/api/goal/<goal_id>", methods=["DELETE"])
def delete_goal(goal_id):
    global data
    goals_before = len(data["goals"])
    data["goals"] = [g for g in data["goals"] if g["id"] != goal_id]

    if len(data["goals"]) == goals_before:
        return jsonify({"error": "Goal not found"}), 404

    return jsonify({"message": "Goal deleted"})

if __name__ == "__main__":
    app.run(debug=True)
