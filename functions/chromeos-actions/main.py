# pylint: disable=missing-module-docstring,missing-function-docstring,unused-argument
# flake8: noqa
import uuid
from logging import Logger
from typing import Dict, Any
from crowdstrike.foundry.function import Function, Request, Response, APIError
from falconpy import APIIntegrations

# pylint: disable=invalid-name
func = Function.instance()

DEFINITION_NAME = "chromeos-api"
MOVE_DEVICE_OP_NAME = "ChromeOS - Move Device to OU"
CHANGE_STATUS_OP_NAME = "ChromeOS - Change Device Status"


@func.handler(method="POST", path="/move_chromeos_device")
def move_chromeos_device(
    request: Request, config: [dict[str, any], None], logger: Logger # type: ignore
) -> Response:
    logger.info("Processing request to move ChromeOS device")
    # Extract parameters from request body
    device_id = request.body.get("device_id")
    ou_path = request.body.get("ou_path")

    # Validate required parameters
    if not device_id or not ou_path:
        logger.error("Missing required parameters")
        err_msg = "Missing required parameters: device_id and ou_path"
        return create_error_response(400, err_msg)

    # Make API Integration call to Move Device
    falcon_api_int = APIIntegrations()
    converted_device_id = convert_device_id(device_id)
    # logger.info(f"Converted device ID: {converted_device_id}")
    body_payload = {
        "resources": [
            {
                "definition_id": DEFINITION_NAME,
                "operation_id": MOVE_DEVICE_OP_NAME,
                "request": {
                    "json": {"deviceIds": [converted_device_id]},
                    "params": {"query": {"orgUnitPath": ou_path}},
                },
            }
        ]
    }
    response = falcon_api_int.execute_command(body=body_payload)
    logger.info(f"API response content: {response}")

    # Check for errors in the response
    if response.get("body", {}).get("errors"):
        errors = response["body"]["errors"]
        logger.error(f"API returned errors: {errors}")
        return create_error_response(
            500, f"Error moving device: {errors[0].get('message', 'Unknown error')}"
        )

    # Check resource status code
    resources = response.get("body", {}).get("resources", [])
    if not resources:
        logger.error("No resources in response")
        return create_error_response(500, "No response from API")

    # Get status code from the first resource
    status_code = resources[0].get("status_code")
    if not status_code or status_code >= 400:
        logger.error(f"Resource operation failed with status {status_code}")
        return create_error_response(status_code or 500, "Failed to move device")

    # Operation was successful
    return Response(
        code=200,
        body={"status": "OK", "message": "Device moved successfully"},
    )


@func.handler(method="POST", path="/change_device_status")
def change_device_status(
    request: Request, config: [dict[str, any], None], logger: Logger # type: ignore
) -> Response:
    logger.info("Processing request to change device status")
    # Extract parameters from request body
    device_id = request.body.get("device_id")
    status = request.body.get("device_status")

    # Validate required parameters
    if not device_id or not status:
        logger.error("Missing required parameters")
        err_msg = "Missing required parameters: device_id and device_status"
        return create_error_response(400, err_msg)

    # Make API Integration call to Change Device Status
    falcon_api_int = APIIntegrations()
    converted_device_id = convert_device_id(device_id)
    status_action = get_status_action(status)
    body_payload = {
        "resources": [
            {
                "definition_id": DEFINITION_NAME,
                "operation_id": CHANGE_STATUS_OP_NAME,
                "request": {
                    "json": {
                        "deviceIds": [converted_device_id],
                        "changeChromeOsDeviceStatusAction": status_action,
                    },
                },
            }
        ]
    }
    response = falcon_api_int.execute_command(body=body_payload)
    logger.info(f"API response content: {response}")

    # Check for errors in the response
    if response.get("body", {}).get("errors"):
        errors = response["body"]["errors"]
        logger.error(f"API returned errors: {errors}")
        return create_error_response(
            500, f"Error moving device: {errors[0].get('message', 'Unknown error')}"
        )

    # Check resource status code
    resources = response.get("body", {}).get("resources", [])
    if not resources:
        logger.error("No resources in response")
        return create_error_response(500, "No response from API")

    # Get status code from the first resource
    status_code = resources[0].get("status_code")
    if not status_code or status_code >= 400:
        logger.error(f"Resource operation failed with status {status_code}")
        return create_error_response(status_code or 500, "Failed to move device")

    # Operation was successful
    return Response(
        code=200,
        body={"status": "OK", "message": "Device status successfully changed"},
    )


def extract_error_message(error_data: Dict[str, Any]) -> str:
    """Extract a meaningful error message from error data.

    Args:
        error_data: Dictionary containing error information

    Returns:
        A string with the most specific error message available
    """
    # First check for specific errors in the errors array
    if "errors" in error_data and error_data["errors"]:
        err = error_data["errors"][0]
        if "message" in err:
            return err["message"]
        if "reason" in err:
            return f"Error reason: {err['reason']}"

    # Fall back to the main message
    if "message" in error_data:
        return error_data["message"]

    # Last resort
    return "Unknown error occurred"


def create_error_response(code: int, message: str) -> Response:
    """Create an error response with the given code and message.

    Args:
        code: HTTP status code
        message: Error message

    Returns:
        Response: API error response
    """
    return Response(
        code=code,
        errors=[
            APIError(
                code=code,
                message=message,
            )
        ],
    )


def get_status_action(status: str) -> str:
    """Convert the user-facing status to the appropriate API action.

    Args:
        status: The status value ("Disabled" or "Provisioned")

    Returns:
        The corresponding API action string

    Raises:
        ValueError: If the status is not recognized
    """
    status_mapping = {
        "Disabled": "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_DISABLE",
        "Provisioned": "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_REENABLE",
    }

    if status not in status_mapping:
        raise ValueError(
            f"Invalid status: {status}. Must be 'Disabled' or 'Provisioned'"
        )

    return status_mapping[status]


def convert_device_id(device_id: str) -> str:
    """Convert and return the device ID to the format required

    Args:
        device_id: The device ID to convert.

    Returns:
        The converted device ID.
    """
    return str(uuid.UUID(hex=device_id))


if __name__ == "__main__":
    func.run()
