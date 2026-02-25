import requests

try:
    print("1", flush=True)
    res = requests.post("http://localhost:8000/api/v1/auth/login", data={"username": "testcx", "password": "password"})
    token = res.json()["access_token"]
    
    print("2", flush=True)
    res2 = requests.post("http://localhost:8000/api/v1/videos/1/comments", json={"text": "testing 123"}, headers={"Authorization": f"Bearer {token}"})
    print("STATUS:", res2.status_code)
    print("TEXT:", res2.text)
except Exception as e:
    print(e)

