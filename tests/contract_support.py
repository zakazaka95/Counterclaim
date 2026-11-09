"""Controlled SDK double for contract logic; live proofs are recorded separately."""
import copy
import importlib.util
import pathlib
import sys
import types
from datetime import datetime as RealDateTime


class UserError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class Runtime:
    def __init__(self):
        self.sender = "0x" + "1" * 40
        self.clock = 1_800_000_000
        self.output = {"milestones": [{"id": "landing-page", "status": "SATISFIED"},
            {"id": "integration-guide", "status": "SATISFIED"},
            {"id": "regression-tests", "status": "NOT_SATISFIED"}], "whole_review": "COMPLETE"}
        self.validator_output = None
        self.mutate = None
        self.phase = "leader"
        self.in_nondet = False
        self.prompts = []
        self.fake = None

    def prompt(self, prompt, response_format=None):
        assert response_format == "json"
        self.prompts.append({"phase": self.phase, "prompt": prompt})
        result = self.validator_output if self.phase == "validator" and self.validator_output is not None else self.output
        if isinstance(result, Exception):
            raise result
        return copy.deepcopy(result)

    def run(self, leader, validator):
        self.in_nondet = True
        try:
            self.phase = "leader"
            candidate = leader()
            if self.mutate:
                candidate = self.mutate(copy.deepcopy(candidate))
            self.phase = "validator"
            if not validator(Return(candidate)):
                raise AssertionError("Independent complete receipt mismatch")
            return candidate
        finally:
            self.in_nondet = False

    def as_sender(self, address):
        self.sender = address
        self.fake.message.sender_address = address


def load():
    runtime = Runtime()
    fake = types.ModuleType("genlayer")
    fake.contract = types.SimpleNamespace(Contract=object)
    fake.storage = types.SimpleNamespace(TreeMap=dict)
    fake.public = types.SimpleNamespace(write=lambda f: f, view=lambda f: f)
    fake.message = types.SimpleNamespace(sender_address=runtime.sender, chain_id=61997, contract_address="0x" + "a" * 40)
    fake.nondet = types.SimpleNamespace(exec_prompt=runtime.prompt)
    fake.vm = types.SimpleNamespace(UserError=UserError, Return=Return, run_nondet_default=runtime.run)
    type_module = types.ModuleType("genlayer.types")
    type_module.u64 = int
    type_module.__all__ = ["u64"]
    previous = {name: sys.modules.get(name) for name in ["genlayer", "genlayer.types"]}
    sys.modules["genlayer"], sys.modules["genlayer.types"] = fake, type_module
    path = pathlib.Path(__file__).resolve().parents[1] / "contracts/CounterclaimCourt.py"
    spec = importlib.util.spec_from_file_location("CounterclaimCourt", path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    finally:
        for name, value in previous.items():
            if value is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value
    runtime.fake = fake

    class Clock:
        @staticmethod
        def now(tz=None):
            if runtime.in_nondet:
                raise AssertionError("Clock must be captured outside independent callbacks")
            return RealDateTime.fromtimestamp(runtime.clock, tz)

    module.datetime = Clock
    contract = module.CounterclaimCourt()
    for name, annotation in module.CounterclaimCourt.__annotations__.items():
        if getattr(annotation, "__origin__", None) is dict:
            setattr(contract, name, {})
    return module, contract, runtime
