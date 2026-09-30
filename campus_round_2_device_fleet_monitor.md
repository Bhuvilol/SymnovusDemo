# Campus Hiring Round 2 – 3-Hour Engineering Project

## Project: Mini Device Fleet Monitor

### Objective

Build a small application that monitors a fleet of simulated devices.

Each device periodically sends a **heartbeat** to the application. The application should track the latest heartbeat for every device and allow an operator to view the current status of the fleet.

This exercise is intended to evaluate how you approach a practical engineering problem, structure your code, use AI tools, test your implementation, and document your work.

---

## Time Limit

**3 hours**

Please prefer a **small, working, well-tested solution** over a large or incomplete implementation.

---

## Technology

You may use any programming language or framework you are comfortable with, for example:

- Go
- Python
- Java
- JavaScript / TypeScript
- C++
- Any other reasonable choice

You may use third-party libraries where appropriate.

---

## Functional Requirements

Your application should support the following capabilities.

### 1. Register a Device

Provide an API to register a new device.

Example:

```http
POST /devices
```

Example request:

```json
{
  "id": "device-01",
  "name": "Lab Device 01"
}
```

---

### 2. Receive a Device Heartbeat

A registered device should be able to send a heartbeat.

Example:

```http
POST /devices/{id}/heartbeat
```

Example request:

```json
{
  "timestamp": "2026-09-21T10:30:00Z",
  "status": "OK"
}
```

You may extend the heartbeat with additional fields if you wish, such as:

```json
{
  "timestamp": "2026-09-21T10:30:00Z",
  "status": "OK",
  "cpu_usage": 42,
  "signal_strength": -71
}
```

Additional fields are optional.

---

### 3. List Devices

Provide an API to list all registered devices and their current status.

Example:

```http
GET /devices
```

Example response:

```json
[
  {
    "id": "device-01",
    "name": "Lab Device 01",
    "status": "ONLINE",
    "last_heartbeat": "2026-09-21T10:30:00Z"
  }
]
```

---

### 4. Get Device Details

Provide an API to retrieve details for a single device.

Example:

```http
GET /devices/{id}
```

---

### 5. Fleet Summary

Provide an API that summarizes the current fleet status.

Example:

```http
GET /summary
```

Example response:

```json
{
  "total": 10,
  "online": 8,
  "offline": 2
}
```

---

## Important Requirement – Device Timeout

A device should be considered:

- **ONLINE** if it has sent a heartbeat within the last **30 seconds**
- **OFFLINE** if no heartbeat has been received for more than **30 seconds**

The status returned by the APIs should reflect this rule automatically.

How you implement this behaviour is up to you.

---

## Device Simulator

Create a small script or program that simulates at least **5 devices** sending heartbeats to your application.

The simulator should make it easy for us to verify that your application works.

For example:

```text
device-01 -> heartbeat every 5 seconds
device-02 -> heartbeat every 5 seconds
device-03 -> heartbeat every 5 seconds
device-04 -> heartbeat every 5 seconds
device-05 -> heartbeat every 5 seconds
```

It should also be possible to stop one of the simulated devices and observe it becoming **OFFLINE** after the timeout.

---

## Testing

Include automated tests for the important parts of your implementation.

At minimum, we expect tests covering:

- Device registration
- Heartbeat handling
- Device status
- The 30-second ONLINE/OFFLINE behaviour

You may add additional tests for validation, error handling, concurrency, or other cases.

---

## Repository Requirements

Submit your work as a Git repository.

A typical repository may look like:

```text
project/
├── README.md
├── src/
├── tests/
└── simulator/
```

The exact structure is up to you.

Your Git history will also be reviewed. Prefer meaningful commits that show the progression of your work.

---

## README Requirements

Your `README.md` should clearly explain:

1. What the project does
2. Your design / architecture
3. Prerequisites
4. How to build the application
5. How to run the application
6. How to run the simulator
7. How to run the tests
8. Example API requests
9. Assumptions you made
10. Known limitations
11. What you would improve if you had one additional day

Someone unfamiliar with your code should be able to clone the repository and run the project using your README.

---

## Use of AI

**AI tools are allowed and encouraged.**

You may use tools such as:

- ChatGPT
- GitHub Copilot
- Claude
- Gemini
- Other coding assistants

However, you are responsible for understanding and validating everything you submit.

Add a short section to your README titled:

```text
## AI Usage
```

Briefly mention:

- Which AI tools you used
- What you used them for
- One suggestion or piece of generated code that you changed, rejected, or improved
- One thing you personally verified before submitting

You are **not required to submit your complete AI conversation history**.

---

## What We Will Evaluate

We are primarily interested in:

- Whether the application works correctly
- How you break down and structure the problem
- Code readability and maintainability
- Error handling
- Testing
- Documentation
- Git usage
- Your ability to use AI effectively while still understanding your solution

Extra functionality is welcome, but it is **not more important than correctness and clarity**.

Please avoid adding unnecessary complexity simply to make the project appear larger.

---

## Optional Enhancements

If you finish the core requirements early, you may add one or more improvements such as:

- Input validation
- Persistent storage
- Structured logging
- Graceful shutdown
- Docker support
- Configuration through environment variables
- Filtering devices by status
- Additional device metrics
- Simple UI
- API documentation
- Concurrency-safe implementation

These are entirely optional.

---

## Submission

Submit:

1. The URL of your Git repository
2. Ensure the repository contains a complete `README.md`
3. Ensure the repository can be cloned and run using the documented instructions

Please make sure your final committed version is submitted before the deadline.

---

## Note

There is no single expected architecture or implementation.

We are interested in seeing how you approach the problem, the choices you make, and how clearly you can explain those choices.
