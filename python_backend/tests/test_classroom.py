import unittest
import httpx
from app.services.classroom_search import JavaRoomFinderClient, parse_bridge_response, ClassroomSearchError
from app.schemas.classroom import ClassroomSearchRequest
from pydantic import ValidationError

class ClassroomTests(unittest.IsolatedAsyncioTestCase):
    async def test_actual_bridge_contract(self):
        import json
        def handler(request):
            body=json.loads(request.content)
            self.assertEqual(request.url.path,'/api/bridge')
            self.assertEqual(body['location_id'],'corp_a')
            self.assertEqual(body['duration_minutes'],80)
            self.assertEqual(body['requested_by']['user_id'],'student')
            return httpx.Response(200,json={'free_rooms':[{'name':'301','location_name':'А','floor':3}], 'alternatives':[], 'reason':None})
        client=JavaRoomFinderClient('http://java:3333','test',12,2)
        client._client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            result=await client.find_rooms('corp_a',80,'student')
            self.assertEqual(result.classroom,'А-301')
            self.assertIsNone(result.additional_data['cameraFree'])
        finally: await client.aclose()

    async def test_java_errors_not_mistaken_for_no_rooms(self):
        with self.assertRaises(ClassroomSearchError) as cm:
            parse_bridge_response({'free_rooms':[],'reason':'Ошибка при запросе к C++ серверу: timeout'})
        self.assertEqual(cm.exception.status_code,504)
        self.assertFalse(parse_bridge_response({'free_rooms':[],'reason':'На сегодня пар больше нет.'}).found)

    async def test_input_uses_real_algorithm_fields(self):
        with self.assertRaises(ValidationError): ClassroomSearchRequest(locationId='unknown',durationMinutes=80)
        with self.assertRaises(ValidationError): ClassroomSearchRequest(locationId='corp_a',durationMinutes=0)
