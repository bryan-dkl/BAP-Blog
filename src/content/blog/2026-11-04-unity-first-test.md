---
title: "Unity first test"
date: 2026-11-04
cover: "../../assets/blog/2026-11-04-unity-first-test/cover.png"
pillars: ["development"]
types: ["experiment","research"]
---

started by testing the waters a bit with unity. made a player object and added a script to it, the script lets the player object follow a path made between a list of empties. 

```
using UnityEngine;

public class PathFollower : MonoBehaviour
{
    public enum EndMode { Stop, Loop, PingPong }

    [Tooltip("Points the object moves through, in order")]
    public Transform[] waypoints;

    [Tooltip("Movement speed in units per second")]
    public float speed = 5f;

    [Tooltip("What to do at the end of the path")]
    public EndMode endMode = EndMode.Loop;

    [Tooltip("Rotate to face the direction of travel")]
    public bool faceDirection = true;
    public float turnSpeed = 10f;

    private int targetIndex = 0;
    private int direction = 1; // used for PingPong
    private bool finished = false;

    void Start()
    {
        if (waypoints.Length > 0)
            transform.position = waypoints[0].position;
        targetIndex = waypoints.Length > 1 ? 1 : 0;
    }

    void Update()
    {
        if (finished || waypoints.Length < 2) return;

        // Distance we're allowed to travel this frame
        float distanceLeft = speed * Time.deltaTime;

        // Loop so fast objects don't overshoot or stall at waypoints
        while (distanceLeft > 0f && !finished)
        {
            Vector3 target = waypoints[targetIndex].position;
            Vector3 toTarget = target - transform.position;
            float distToTarget = toTarget.magnitude;

            if (faceDirection && distToTarget > 0.001f)
            {
                Quaternion look = Quaternion.LookRotation(toTarget);
                transform.rotation = Quaternion.Slerp(transform.rotation, look, turnSpeed * Time.deltaTime);
            }

            if (distanceLeft >= distToTarget)
            {
                // Reach the waypoint and carry the leftover distance to the next one
                transform.position = target;
                distanceLeft -= distToTarget;
                AdvanceWaypoint();
            }
            else
            {
                transform.position += toTarget / distToTarget * distanceLeft;
                distanceLeft = 0f;
            }
        }
    }

    void AdvanceWaypoint()
    {
        switch (endMode)
        {
            case EndMode.Stop:
                if (targetIndex >= waypoints.Length - 1) finished = true;
                else targetIndex++;
                break;

            case EndMode.Loop:
                targetIndex = (targetIndex + 1) % waypoints.Length;
                break;

            case EndMode.PingPong:
                if (targetIndex + direction >= waypoints.Length || targetIndex + direction < 0)
                    direction *= -1;
                targetIndex += direction;
                break;
        }
    }

    // Draws the path in the Scene view
    void OnDrawGizmos()
    {
        if (waypoints == null || waypoints.Length < 2) return;
        Gizmos.color = Color.yellow;
        for (int i = 0; i < waypoints.Length - 1; i++)
        {
            if (waypoints[i] && waypoints[i + 1])
                Gizmos.DrawLine(waypoints[i].position, waypoints[i + 1].position);
        }
        if (endMode == EndMode.Loop && waypoints[0] && waypoints[^1])
            Gizmos.DrawLine(waypoints[^1].position, waypoints[0].position);
    }
}```

made a script that creates a building with a random height out of precomposed building pieces. 

```
using UnityEngine;

public class BuildingGenerator : MonoBehaviour
{
    [Header("Building Pieces (prefabs)")]
    public GameObject[] basePrefabs;
    public GameObject[] midPrefabs;
    public GameObject[] topPrefabs;

    [Header("Height")]
    [Min(0)] public int minMidStacks = 3;
    [Min(0)] public int maxMidStacks = 10;

    [Header("Options")]
    [Tooltip("Use the same mid section for every floor (like 10x mid 3). Turn off to mix them.")]
    public bool sameMidForAllFloors = true;

    [Tooltip("Rebuild with a new random building when the game starts")]
    public bool buildOnStart = false;

    [Tooltip("Use a fixed seed to get the same building every time. 0 = random.")]
    public int seed = 0;

    void Start()
    {
        if (buildOnStart) Build();
    }

    [ContextMenu("Build Building")]
    public void Build()
    {
        Clear();

        if (seed != 0) Random.InitState(seed);

        float currentHeight = 0f;

        // Base
        currentHeight = PlacePiece(PickRandom(basePrefabs), currentHeight, "Base");

        // Mid sections
        int stacks = Random.Range(minMidStacks, maxMidStacks + 1);
        GameObject chosenMid = PickRandom(midPrefabs);
        for (int i = 0; i < stacks; i++)
        {
            GameObject mid = sameMidForAllFloors ? chosenMid : PickRandom(midPrefabs);
            currentHeight = PlacePiece(mid, currentHeight, "Mid " + (i + 1));
        }

        // Top
        PlacePiece(PickRandom(topPrefabs), currentHeight, "Top");
    }

    [ContextMenu("Clear Building")]
    public void Clear()
    {
        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            GameObject child = transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(child);
            else DestroyImmediate(child);
        }
    }

    // Places a piece with its bottom at 'height' and returns the height of its top
    float PlacePiece(GameObject prefab, float height, string pieceName)
    {
        if (prefab == null) return height;

        GameObject piece = Instantiate(prefab, transform);
        piece.name = pieceName + " (" + prefab.name + ")";
        piece.transform.localPosition = Vector3.zero;
        piece.transform.localRotation = Quaternion.identity;

        // Measure the piece so it stacks correctly, whatever its pivot
        Bounds bounds = GetLocalBounds(piece);
        float bottomOffset = bounds.min.y;
        float pieceHeight = bounds.size.y;

        piece.transform.localPosition = new Vector3(0f, height - bottomOffset, 0f);

        return height + pieceHeight;
    }

    // Combined bounds of all renderers, in this object's local space
    Bounds GetLocalBounds(GameObject piece)
    {
        Renderer[] renderers = piece.GetComponentsInChildren<Renderer>();
        if (renderers.Length == 0) return new Bounds(Vector3.zero, Vector3.zero);

        Bounds local = new Bounds();
        bool first = true;

        foreach (Renderer r in renderers)
        {
            Bounds b = r.bounds; // world space
            // Convert all 8 corners into local space
            for (int x = 0; x < 2; x++)
                for (int y = 0; y < 2; y++)
                    for (int z = 0; z < 2; z++)
                    {
                        Vector3 corner = new Vector3(
                            x == 0 ? b.min.x : b.max.x,
                            y == 0 ? b.min.y : b.max.y,
                            z == 0 ? b.min.z : b.max.z);
                        Vector3 p = transform.InverseTransformPoint(corner);
                        if (first) { local = new Bounds(p, Vector3.zero); first = false; }
                        else local.Encapsulate(p);
                    }
        }

        // Bounds relative to the piece's own position
        local.center -= piece.transform.localPosition;
        return local;
    }

    GameObject PickRandom(GameObject[] options)
    {
        if (options == null || options.Length == 0) return null;
        return options[Random.Range(0, options.Length)];
    }
}
```
