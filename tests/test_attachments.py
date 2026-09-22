import io
import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_attachment_upload_and_download_flow(async_client: AsyncClient):
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")
    
    # 1. Create a ticket first
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    it_dept = next(d for d in depts_res.json() if d["code"] == "IT")
    
    create_ticket_res = await async_client.post(
        "/api/v1/tickets/",
        json={
            "title": "VPN Server Connectivity Logs",
            "description": "Attached diagnostic log files.",
            "priority": "HIGH",
            "department_id": it_dept["id"],
        },
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert create_ticket_res.status_code == 201
    ticket_id = create_ticket_res.json()["id"]

    # 2. Upload valid attachment (log file)
    log_content = b"2026-09-22 10:00:00 [ERROR] VPN Gateway handshake timed out"
    upload_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/attachments",
        files={"file": ("vpn_diagnostics.log", io.BytesIO(log_content), "text/plain")},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert upload_res.status_code == 201
    attach_data = upload_res.json()
    assert attach_data["filename"] == "vpn_diagnostics.log"
    assert attach_data["file_size"] == len(log_content)
    attach_id = attach_data["id"]

    # 3. List attachments
    list_res = await async_client.get(
        f"/api/v1/tickets/{ticket_id}/attachments",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    assert any(a["id"] == attach_id for a in items)

    # 4. Download attachment
    dl_res = await async_client.get(
        f"/api/v1/attachments/{attach_id}/download",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert dl_res.status_code == 200
    assert dl_res.content == log_content

    # 5. Delete attachment
    del_res = await async_client.delete(
        f"/api/v1/attachments/{attach_id}",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_attachment_invalid_extension(async_client: AsyncClient):
    requester_token = await get_auth_token(async_client, "requester@enterprise.local", "RequesterPass123!")
    
    depts_res = await async_client.get(
        "/api/v1/workflows/departments",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    it_dept = next(d for d in depts_res.json() if d["code"] == "IT")

    create_ticket_res = await async_client.post(
        "/api/v1/tickets/",
        json={
            "title": "Executable Test Ticket",
            "description": "Testing rejection of unsafe file types.",
            "priority": "LOW",
            "department_id": it_dept["id"],
        },
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    ticket_id = create_ticket_res.json()["id"]

    # Upload disallowed .exe
    exe_content = b"MZ\x90\x00\x03\x00\x00\x00"
    upload_res = await async_client.post(
        f"/api/v1/tickets/{ticket_id}/attachments",
        files={"file": ("malware.exe", io.BytesIO(exe_content), "application/octet-stream")},
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert upload_res.status_code == 400
    assert "not supported" in upload_res.json()["detail"]
