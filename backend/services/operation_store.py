"""Redis 기반 작업 상태 저장소"""

import redis
import json
import logging
from datetime import timedelta
from typing import Optional, Dict, Any
from config.settings import REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD

# 로깅 설정
logger = logging.getLogger(__name__)


class OperationStore:
    """Redis 기반 작업 상태 저장소"""
    
    def __init__(self):
        """Redis 클라이언트 초기화"""
        try:
            self.redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # 연결 테스트
            self.redis_client.ping()
            logger.info("Redis 연결 성공")
        except redis.ConnectionError as e:
            logger.error(f"Redis 연결 실패: {e}")
            raise
        except Exception as e:
            logger.error(f"Redis 초기화 오류: {e}")
            raise
        
        # 기본 TTL (10분)
        self.default_ttl = timedelta(minutes=10)
    
    def store_operation(self, operation_id: str, operation_data: Dict[str, Any]) -> bool:
        """
        작업 정보를 Redis에 저장
        
        Args:
            operation_id: 작업 고유 ID
            operation_data: 저장할 작업 데이터
            
        Returns:
            bool: 저장 성공 여부
        """
        try:
            # JSON 직렬화
            serialized_data = json.dumps(operation_data, default=str, ensure_ascii=False)
            
            # Redis에 TTL과 함께 저장
            success = self.redis_client.setex(
                name=f"operation:{operation_id}",
                time=self.default_ttl,
                value=serialized_data
            )
            
            if success:
                logger.info(f"작업 저장 성공: {operation_id}")
                return True
            else:
                logger.warning(f"작업 저장 실패: {operation_id}")
                return False
                
        except json.JSONEncodeError as e:
            logger.error(f"JSON 직렬화 오류: {e}")
            return False
        except redis.RedisError as e:
            logger.error(f"Redis 저장 오류: {e}")
            return False
        except Exception as e:
            logger.error(f"작업 저장 중 예상치 못한 오류: {e}")
            return False
    
    def get_operation(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """
        작업 정보를 Redis에서 조회
        
        Args:
            operation_id: 작업 고유 ID
            
        Returns:
            Optional[Dict[str, Any]]: 작업 데이터 또는 None
        """
        try:
            data = self.redis_client.get(f"operation:{operation_id}")
            
            if data:
                operation_data = json.loads(data)
                logger.info(f"작업 조회 성공: {operation_id}")
                return operation_data
            else:
                logger.info(f"작업을 찾을 수 없음: {operation_id}")
                return None
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON 역직렬화 오류: {e}")
            return None
        except redis.RedisError as e:
            logger.error(f"Redis 조회 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"작업 조회 중 예상치 못한 오류: {e}")
            return None
    
    def delete_operation(self, operation_id: str) -> bool:
        """
        작업 정보를 Redis에서 삭제
        
        Args:
            operation_id: 작업 고유 ID
            
        Returns:
            bool: 삭제 성공 여부
        """
        try:
            deleted_count = self.redis_client.delete(f"operation:{operation_id}")
            
            if deleted_count > 0:
                logger.info(f"작업 삭제 성공: {operation_id}")
                return True
            else:
                logger.info(f"삭제할 작업이 없음: {operation_id}")
                return False
                
        except redis.RedisError as e:
            logger.error(f"Redis 삭제 오류: {e}")
            return False
        except Exception as e:
            logger.error(f"작업 삭제 중 예상치 못한 오류: {e}")
            return False
    
    def get_remaining_ttl(self, operation_id: str) -> int:
        """
        작업의 남은 TTL 시간 확인
        
        Args:
            operation_id: 작업 고유 ID
            
        Returns:
            int: 남은 TTL 시간 (초), 키가 없거나 TTL이 없으면 -1
        """
        try:
            ttl = self.redis_client.ttl(f"operation:{operation_id}")
            return ttl if ttl >= 0 else -1
        except redis.RedisError as e:
            logger.error(f"TTL 조회 오류: {e}")
            return -1
        except Exception as e:
            logger.error(f"TTL 조회 중 예상치 못한 오류: {e}")
            return -1
    
    def extend_ttl(self, operation_id: str, additional_time: timedelta = None) -> bool:
        """
        작업의 TTL을 연장
        
        Args:
            operation_id: 작업 고유 ID
            additional_time: 추가할 시간 (기본값: 10분)
            
        Returns:
            bool: TTL 연장 성공 여부
        """
        try:
            extend_time = additional_time or timedelta(minutes=10)
            success = self.redis_client.expire(f"operation:{operation_id}", extend_time)
            
            if success:
                logger.info(f"TTL 연장 성공: {operation_id}")
                return True
            else:
                logger.info(f"TTL 연장 실패 (키 없음): {operation_id}")
                return False
                
        except redis.RedisError as e:
            logger.error(f"TTL 연장 오류: {e}")
            return False
        except Exception as e:
            logger.error(f"TTL 연장 중 예상치 못한 오류: {e}")
            return False
    
    def health_check(self) -> bool:
        """
        Redis 연결 상태 확인
        
        Returns:
            bool: 연결 상태 정상 여부
        """
        try:
            self.redis_client.ping()
            return True
        except redis.RedisError:
            return False
        except Exception:
            return False


# 싱글톤 인스턴스
_operation_store_instance: Optional[OperationStore] = None


def get_operation_store() -> OperationStore:
    """
    OperationStore 인스턴스를 반환하는 의존성 주입 함수
    
    Returns:
        OperationStore: 작업 저장소 인스턴스
    """
    global _operation_store_instance
    
    if _operation_store_instance is None:
        _operation_store_instance = OperationStore()
    
    return _operation_store_instance


def reset_operation_store():
    """
    테스트용 - 저장소 인스턴스 리셋
    """
    global _operation_store_instance
    _operation_store_instance = None 