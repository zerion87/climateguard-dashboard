from flask import Flask, jsonify, make_response
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

DATA_DIR = '/data'
COUNTER_FILE = os.path.join(DATA_DIR, 'counter.txt')

def get_count():
    if not os.path.exists(COUNTER_FILE):
        return 0
    with open(COUNTER_FILE, 'r') as f:
        try:
            return int(f.read())
        except ValueError:
            return 0

def set_count(count):
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    with open(COUNTER_FILE, 'w') as f:
        f.write(str(count))

@app.route('/api/counter', methods=['GET'])
def get_visitor_count():
    count = get_count()
    return jsonify({'count': count})

@app.route('/api/counter/increment', methods=['POST'])
def increment_visitor_count():
    count = get_count()
    count += 1
    set_count(count)
    return jsonify({'count': count})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Create the data directory if it doesn't exist
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    # Initialize counter file if it doesn't exist
    if not os.path.exists(COUNTER_FILE):
        set_count(0)

    app.run(host='0.0.0.0', port=5000)
