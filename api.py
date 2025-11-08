from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow cross-origin access (frontend to backend)

@app.route("/", methods=["GET"])
def home():
    """Root route to confirm the server is running"""
    try:
        return jsonify({"message": "Flask API is running successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/data", methods=["POST"])
def receive_data():
    """
    Example POST endpoint that receives JSON from the client
    and responds with confirmation.
    """
    try:
        # Try to get JSON data from request body
        data = request.get_json(force=True)
        if not data:
            return jsonify({"status": "failed", "message": "No JSON data received"}), 400

        # Example: handle or log data
        print("Received data:", data)

        # Return success response
        return jsonify({
            "status": "success",
            "message": "Data received successfully",
            "received_data": data
        }), 200

    except Exception as e:
        # Handle parsing or unexpected server errors
        print("Error in /api/data:", e)
        return jsonify({
            "status": "error",
            "message": f"An error occurred: {str(e)}"
        }), 500


@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors gracefully"""
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(500)
def server_error(e):
    """Handle internal server errors gracefully"""
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    try:
        print("Starting Flask API on port 5000...")
        app.run(host="0.0.0.0", port=8080, debug=True)
    except Exception as e:
        print("Error starting the Flask app:", e)
