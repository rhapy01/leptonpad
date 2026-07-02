// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LeptonSplit
 * @notice x402 seller — collects USDC on Arc, splits atomically per verified settlement id.
 * @dev Creator routing is locked at publish time. Each x402 settlement id can only be split once.
 */
contract LeptonSplit {
    address public immutable platformWallet;
    address public owner;

    uint16 public constant STANDARD_CREATOR_BPS = 9500;
    uint16 public constant MAX_BPS = 10000;

    mapping(uint256 => address) public contentCreator;
    mapping(uint256 => uint16) public contentBps;
    mapping(address => uint16) public tipCreatorBps;
    mapping(bytes32 => bool) public settlementClaimed;

    event ContentRegistered(uint256 indexed contentId, address indexed creator, uint16 bps);
    event TipCreatorRegistered(address indexed creator, uint16 bps);
    event SplitPayment(
        bytes32 indexed settlementId,
        uint256 indexed contentId,
        address indexed creator,
        uint256 total,
        uint256 toCreator,
        uint256 toPlatform
    );
    event SplitTip(
        bytes32 indexed settlementId,
        address indexed creator,
        uint256 total,
        uint256 toCreator,
        uint256 toPlatform
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "LeptonSplit: not owner");
        _;
    }

    constructor(address _platformWallet) {
        require(_platformWallet != address(0), "LeptonSplit: zero platform");
        platformWallet = _platformWallet;
        owner = msg.sender;
    }

    receive() external payable {}

    /// @notice Lock creator payout route at publish time — cannot be changed after.
    function registerContentCreator(uint256 contentId, address creator, uint16 bps) external onlyOwner {
        require(contentCreator[contentId] == address(0), "LeptonSplit: content locked");
        require(creator != address(0), "LeptonSplit: zero creator");
        require(bps > 0 && bps <= MAX_BPS, "LeptonSplit: bps");
        contentCreator[contentId] = creator;
        contentBps[contentId] = bps;
        emit ContentRegistered(contentId, creator, bps);
    }

    /// @notice Lock tip bps per creator wallet — set once.
    function registerTipCreator(address creator, uint16 bps) external onlyOwner {
        require(tipCreatorBps[creator] == 0, "LeptonSplit: tip creator locked");
        require(creator != address(0), "LeptonSplit: zero creator");
        require(bps > 0 && bps <= MAX_BPS, "LeptonSplit: bps");
        tipCreatorBps[creator] = bps;
        emit TipCreatorRegistered(creator, bps);
    }

    function splitPayment(bytes32 settlementId, uint256 contentId, uint256 amount) external onlyOwner {
        require(settlementId != bytes32(0), "LeptonSplit: zero settlement");
        require(!settlementClaimed[settlementId], "LeptonSplit: settlement used");
        address creator = contentCreator[contentId];
        require(creator != address(0), "LeptonSplit: content not registered");
        uint16 bps = contentBps[contentId];
        if (bps == 0) bps = STANDARD_CREATOR_BPS;

        (uint256 toCreator, uint256 toPlatform) = _splitAmounts(bps, amount);
        require(address(this).balance >= amount, "LeptonSplit: insufficient balance");

        settlementClaimed[settlementId] = true;
        _transfer(creator, toCreator);
        _transfer(platformWallet, toPlatform);
        emit SplitPayment(settlementId, contentId, creator, amount, toCreator, toPlatform);
    }

    function splitToCreator(bytes32 settlementId, address creator, uint256 amount) external onlyOwner {
        require(settlementId != bytes32(0), "LeptonSplit: zero settlement");
        require(!settlementClaimed[settlementId], "LeptonSplit: settlement used");
        require(creator != address(0), "LeptonSplit: zero creator");
        uint16 bps = tipCreatorBps[creator];
        if (bps == 0) bps = STANDARD_CREATOR_BPS;

        (uint256 toCreator, uint256 toPlatform) = _splitAmounts(bps, amount);
        require(address(this).balance >= amount, "LeptonSplit: insufficient balance");

        settlementClaimed[settlementId] = true;
        _transfer(creator, toCreator);
        _transfer(platformWallet, toPlatform);
        emit SplitTip(settlementId, creator, amount, toCreator, toPlatform);
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _splitAmounts(uint16 bps, uint256 amount)
        internal
        pure
        returns (uint256 toCreator, uint256 toPlatform)
    {
        toCreator = (amount * bps) / MAX_BPS;
        toPlatform = amount - toCreator;
    }

    function _transfer(address to, uint256 value) internal {
        (bool ok,) = payable(to).call{value: value}("");
        require(ok, "LeptonSplit: transfer failed");
    }
}
