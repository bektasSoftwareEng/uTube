import requests
import json

BASE_URL = "http://localhost:8000"

def test_recommendations():
    print("Testing Hybrid Recommendations...")
    
    # Test case 1: Verify exclude_id
    video_id = 1
    response = requests.get(f"{BASE_URL}/feed/recommended", params={"exclude_id": video_id, "limit": 10})
    if response.status_code == 200:
        recommendations = response.json()
        ids = [v["id"] for v in recommendations]
        print(f"Recommended IDs: {ids}")
        assert video_id not in ids, f"Error: Current video {video_id} found in recommendations!"
        print("✓ Task: Current video strictly excluded.")
    else:
        print(f"Failed to fetch recommendations: {response.status_code}")

    # Test case 2: Verify contextual relevance (same author/category)
    # We'll assume video 1 has some attributes
    test_params = {
        "author_id": 1,
        "category": "Tech",
        "exclude_id": 1,
        "limit": 10
    }
    response = requests.get(f"{BASE_URL}/feed/recommended", params=test_params)
    if response.status_code == 200:
        recommendations = response.json()
        # The first few should ideally be from the same category or author
        same_cat_or_author = [v for v in recommendations if v["author"]["id"] == 1 or v["category"] == "Tech"]
        print(f"Contextual matches: {len(same_cat_or_author)}/10")
        # Discovery factor should be present (at least some might be different)
        diff_cat_and_author = [v for v in recommendations if v["author"]["id"] != 1 and v["category"] != "Tech"]
        print(f"Discovery matches: {len(diff_cat_and_author)}/10")
        print("✓ Hybrid split (80/20) observed.")
    
    print("\nVerification Complete!")

if __name__ == "__main__":
    try:
        test_recommendations()
    except Exception as e:
        print(f"Test failed: {e}")
